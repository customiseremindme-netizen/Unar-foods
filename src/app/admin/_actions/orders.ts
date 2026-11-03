"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { check, runAdminAction, UserFacingError, type ActionResult } from "@/lib/admin/action";
import { logAdminAction } from "@/lib/audit";
import { revalidateStorefront } from "@/lib/cache";
import { rupeesToPaise } from "@/lib/money";
import { createRazorpayRefund, isRazorpayConfigured, RazorpayError } from "@/lib/payments/razorpay";
import { isPhonePeConfigured, PhonePeError, refundPhonePePayment } from "@/lib/payments/phonepe";
import { confirmManualUpiPayment, reconcileOrderPayment } from "@/lib/commerce/payments";
import { notifyOrder, trackingExtra, type OrderTemplate } from "@/lib/notifications/order-notifications";
import { getAllSettings } from "@/lib/settings";
import { syncShiprocketShipment } from "@/lib/shipping/tracking-sync";
import {
  createShiprocketOrder,
  isShiprocketConfigured,
  ShiprocketError,
} from "@/lib/shipping/shiprocket";
import { requireServiceDb } from "@/lib/db/client";

const id = z.uuid();

function done(orderId: string) {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

function dbError(message: string) {
  if (message.includes("ORDER_NOT_PAID")) return "This order hasn't been paid yet.";
  if (message.includes("ORDER_NOT_PLACED")) return "Only confirmed orders can be updated.";
  if (message.includes("CANNOT_CANCEL_SHIPPED")) return "Shipped orders can't be cancelled. Use a refund instead.";
  if (message.includes("REFUND_EXCEEDS_TOTAL")) return "That refund is more than the amount left to refund.";
  if (message.includes("NOT_COD_PENDING")) return "This order isn't waiting for a Cash on Delivery payment.";
  if (message.includes("FORBIDDEN")) return "You don't have permission to do that.";
  return "Could not update the order.";
}

export async function setFulfillmentAction(input: {
  orderId: string;
  status: "processing" | "packed" | "shipped" | "delivered" | "returned" | "unfulfilled";
  message?: string;
  notifyCustomer: boolean;
}): Promise<ActionResult> {
  return runAdminAction("orders.write", async ({ db }) => {
    const data = z
      .object({
        orderId: id,
        status: z.enum(["processing", "packed", "shipped", "delivered", "returned", "unfulfilled"]),
        message: z.string().max(300).optional(),
        notifyCustomer: z.boolean(),
      })
      .parse(input);
    const { error } = await db.rpc("set_fulfillment_status", {
      p_order_id: data.orderId,
      p_status: data.status,
      p_message: data.message ?? "",
      p_customer_visible: true,
    });
    if (error) throw new UserFacingError(dbError(error.message));
    if (data.notifyCustomer && (data.status === "shipped" || data.status === "delivered")) {
      const { data: shipment } = await db
        .from("shipments")
        .select("carrier, tracking_number, tracking_url")
        .eq("order_id", data.orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      await notifyOrder(
        data.orderId,
        data.status === "shipped" ? "order_shipped" : "order_delivered",
        shipment ? trackingExtra({ carrier: shipment.carrier, trackingNumber: shipment.tracking_number, trackingUrl: shipment.tracking_url }) : undefined,
      );
    }
    await logAdminAction({ action: "order.fulfillment", entityType: "order", entityId: data.orderId, summary: `Fulfilment set to ${data.status}` });
    done(data.orderId);
    return { ok: true, message: `Order marked as ${data.status}.` };
  });
}

const shipmentSchema = z.object({
  carrier: z.string().trim().max(80).optional().transform((v) => v || null),
  tracking_number: z.string().trim().max(80).optional().transform((v) => v || null),
  tracking_url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || /^https:\/\//i.test(v), "Tracking link must start with https://"),
  status: z.enum(["pending", "packed", "shipped", "in_transit", "out_for_delivery", "delivered", "returned", "cancelled"]),
});

export async function saveShipmentAction(input: {
  orderId: string;
  shipmentId?: string;
  shipment: z.input<typeof shipmentSchema>;
  note?: string;
}): Promise<ActionResult> {
  return runAdminAction("orders.write", async ({ db }) => {
    const orderId = id.parse(input.orderId);
    const s = shipmentSchema.parse(input.shipment);
    const timestamps = {
      shipped_at: ["shipped", "in_transit", "out_for_delivery", "delivered"].includes(s.status) ? new Date().toISOString() : null,
      delivered_at: s.status === "delivered" ? new Date().toISOString() : null,
    };
    let shipmentId = input.shipmentId;
    if (shipmentId) {
      id.parse(shipmentId);
      const { data: existing } = check(await db.from("shipments").select("shipped_at, delivered_at").eq("id", shipmentId).single());
      check(
        await db
          .from("shipments")
          .update({ ...s, shipped_at: existing?.shipped_at ?? timestamps.shipped_at, delivered_at: existing?.delivered_at ?? timestamps.delivered_at })
          .eq("id", shipmentId),
      );
    } else {
      const { data } = check(await db.from("shipments").insert({ order_id: orderId, provider: "manual", ...s, ...timestamps }).select("id").single());
      shipmentId = data!.id;
    }
    check(
      await db.from("shipment_events").insert({
        shipment_id: shipmentId,
        status: s.status,
        description: input.note?.slice(0, 300) || null,
        source: "admin",
      }),
    );
    await logAdminAction({ action: "order.shipment", entityType: "order", entityId: orderId, summary: `Shipment ${s.carrier ?? ""} ${s.tracking_number ?? ""} → ${s.status}` });
    done(orderId);
    return { ok: true, message: "Shipment saved." };
  });
}

export async function addOrderNoteAction(orderId: string, message: string, customerVisible: boolean): Promise<ActionResult> {
  return runAdminAction("orders.write", async ({ db, user }) => {
    const text = z.string().trim().min(1, "Write a note first").max(1000).parse(message);
    check(
      await db.from("order_events").insert({
        order_id: id.parse(orderId),
        type: customerVisible ? "update" : "note",
        message: text,
        visibility: customerVisible ? "customer" : "internal",
        actor_id: user.id,
      }),
    );
    done(orderId);
    return { ok: true, message: customerVisible ? "Update added to the customer's order page." : "Internal note added." };
  });
}

export async function markCodCollectedAction(orderId: string): Promise<ActionResult> {
  return runAdminAction("orders.write", async ({ db }) => {
    const { error } = await db.rpc("mark_cod_collected", { p_order_id: id.parse(orderId) });
    if (error) throw new UserFacingError(dbError(error.message));
    await logAdminAction({ action: "order.cod_collected", entityType: "order", entityId: orderId, summary: "Marked COD payment as collected" });
    await notifyOrder(orderId, "invoice");
    done(orderId);
    return { ok: true, message: "Cash on Delivery payment recorded." };
  });
}

/** Staff checked their UPI app and the money for a "UPI to our UPI ID" order arrived. */
export async function confirmUpiPaymentAction(orderId: string, reference: string): Promise<ActionResult> {
  return runAdminAction("orders.write", async ({ db }) => {
    id.parse(orderId);
    const ref = z
      .string()
      .trim()
      .transform((v) => v.replace(/\s+/g, "").toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9]{6,35}$/, "Enter the UPI transaction ID (UTR) from your UPI app"))
      .parse(reference);
    const { data: order } = check(await db.from("orders").select("payment_method, status").eq("id", orderId).single());
    if (order!.payment_method !== "upi_manual") throw new UserFacingError("This order wasn't paid by UPI to your UPI ID.");
    let result: string;
    try {
      result = await confirmManualUpiPayment(orderId, ref);
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes("PAYMENT_BELONGS_TO_ANOTHER_ORDER")) throw new UserFacingError("This UPI reference was already used to confirm another order.");
      throw error;
    }
    if (result === "amount_mismatch" || result === "invalid") throw new UserFacingError("Could not confirm this payment.");
    await requireServiceDb().from("orders").update({ needs_attention: false, attention_reason: null }).eq("id", orderId);
    await logAdminAction({ action: "order.upi_confirmed", entityType: "order", entityId: orderId, summary: `Confirmed UPI payment ${ref}` });
    done(orderId);
    return { ok: true, message: result === "already_paid" ? "This order was already paid." : "UPI payment confirmed. The customer has been emailed." };
  });
}

export async function clearAttentionAction(orderId: string): Promise<ActionResult> {
  return runAdminAction("orders.write", async ({ db, user }) => {
    check(await db.from("orders").update({ needs_attention: false }).eq("id", id.parse(orderId)));
    check(await db.from("order_events").insert({ order_id: orderId, type: "note", message: "Attention flag cleared.", visibility: "internal", actor_id: user.id }));
    done(orderId);
    return { ok: true, message: "Marked as resolved." };
  });
}

async function issueRefund(input: {
  orderId: string;
  amountPaise: number;
  reason: string;
  restock: boolean;
}): Promise<{ provider: "razorpay" | "phonepe" | "manual"; providerRefundId: string | null; status: "pending" | "processed" }> {
  const admin = requireServiceDb();
  const { data: order } = await admin
    .from("orders")
    .select("id, order_number, payment_method, payment_status, total_paise, refunded_paise")
    .eq("id", input.orderId)
    .single();
  if (!order) throw new UserFacingError("Order not found.");
  if (input.amountPaise <= 0) throw new UserFacingError("Enter a refund amount.");
  if (input.amountPaise > order.total_paise - order.refunded_paise) throw new UserFacingError("That refund is more than the amount left to refund.");

  let provider: "razorpay" | "phonepe" | "manual" = "manual";
  let providerRefundId: string | null = null;
  let status: "pending" | "processed" = "processed";

  if (order.payment_method === "razorpay") {
    if (!isRazorpayConfigured()) throw new UserFacingError("Razorpay is not configured, so an online refund can't be sent.");
    const { data: payment } = await admin
      .from("payments")
      .select("provider_payment_id")
      .eq("order_id", order.id)
      .eq("provider", "razorpay")
      .in("status", ["captured", "partially_refunded"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!payment?.provider_payment_id) throw new UserFacingError("No captured Razorpay payment found for this order.");
    try {
      const refund = await createRazorpayRefund({
        paymentId: payment.provider_payment_id,
        amountPaise: input.amountPaise,
        notes: { order_number: order.order_number, reason: input.reason.slice(0, 200) },
      });
      provider = "razorpay";
      providerRefundId = refund.id;
      status = refund.status === "processed" ? "processed" : "pending";
    } catch (e) {
      if (e instanceof RazorpayError) throw new UserFacingError(`Razorpay refused the refund: ${e.message}`);
      throw e;
    }
  }
  if (order.payment_method === "phonepe") {
    if (!isPhonePeConfigured()) throw new UserFacingError("PhonePe is not configured, so an online refund can't be sent.");
    const { data: payment } = await admin
      .from("payments")
      .select("provider_order_id")
      .eq("order_id", order.id)
      .eq("provider", "phonepe")
      .in("status", ["captured", "partially_refunded"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!payment?.provider_order_id) throw new UserFacingError("No completed PhonePe payment found for this order.");
    try {
      const refund = await refundPhonePePayment({
        merchantRefundId: `${order.order_number}-RF${Date.now().toString(36)}`,
        merchantOrderId: payment.provider_order_id,
        amountPaise: input.amountPaise,
      });
      provider = "phonepe";
      providerRefundId = refund.refundId;
      status = refund.state === "COMPLETED" ? "processed" : "pending";
    } catch (e) {
      if (e instanceof PhonePeError) throw new UserFacingError(`PhonePe refused the refund: ${e.message}`);
      throw e;
    }
  }
  // Cash on delivery and UPI to your own UPI ID: you send the money back yourself; this records it.
  return { provider, providerRefundId, status };
}

export async function refundOrderAction(input: { orderId: string; amount: string; reason: string; restock: boolean }): Promise<ActionResult> {
  return runAdminAction("orders.refund", async ({ db }) => {
    const orderId = id.parse(input.orderId);
    const amountPaise = rupeesToPaise(input.amount);
    if (amountPaise === null) throw new UserFacingError("Enter a valid amount, e.g. 149 or 149.50");
    const reason = z.string().trim().min(3, "Add a short reason").max(300).parse(input.reason);
    const refund = await issueRefund({ orderId, amountPaise, reason, restock: input.restock });
    const { error } = await db.rpc("record_refund", {
      p_order_id: orderId,
      p_provider: refund.provider,
      p_provider_refund_id: refund.providerRefundId ?? "",
      p_amount_paise: amountPaise,
      p_status: refund.status,
      p_reason: reason,
      p_restock: input.restock,
    });
    if (error) throw new UserFacingError(dbError(error.message));
    if (input.restock) revalidateStorefront();
    await notifyOrder(orderId, "refund_issued");
    await logAdminAction({
      action: "order.refund",
      entityType: "order",
      entityId: orderId,
      summary: `Refund ₹${(amountPaise / 100).toFixed(2)} via ${refund.provider}${input.restock ? " (restocked)" : ""}`,
    });
    done(orderId);
    return {
      ok: true,
      message:
        refund.provider === "razorpay"
          ? "Refund sent to Razorpay. It may take a few working days to reach the customer."
          : "Refund recorded. Remember to send the money to the customer yourself (e.g. bank transfer/UPI).",
    };
  });
}

export async function cancelOrderAction(input: { orderId: string; reason: string; restock: boolean; refund: boolean }): Promise<ActionResult> {
  return runAdminAction("orders.cancel", async ({ db, access }) => {
    const orderId = id.parse(input.orderId);
    const reason = z.string().trim().min(3, "Add a short reason").max(300).parse(input.reason);
    const { data: order } = check(await db.from("orders").select("payment_status, total_paise, refunded_paise").eq("id", orderId).single());
    const { error } = await db.rpc("admin_cancel_order", { p_order_id: orderId, p_reason: reason, p_restock: input.restock });
    if (error) throw new UserFacingError(dbError(error.message));
    let refundNote = "";
    const remaining = order!.total_paise - order!.refunded_paise;
    if (input.refund && ["paid", "partially_refunded"].includes(order!.payment_status) && remaining > 0) {
      if (!access.permissions.has("orders.refund")) {
        refundNote = " A refund still needs to be issued by an owner/admin.";
      } else {
        const refund = await issueRefund({ orderId, amountPaise: remaining, reason, restock: false });
        const r = await db.rpc("record_refund", {
          p_order_id: orderId,
          p_provider: refund.provider,
          p_provider_refund_id: refund.providerRefundId ?? "",
          p_amount_paise: remaining,
          p_status: refund.status,
          p_reason: reason,
          p_restock: false,
        });
        if (r.error) throw new UserFacingError(dbError(r.error.message));
        refundNote = " Full refund issued.";
      }
    }
    revalidateStorefront();
    await notifyOrder(orderId, "order_cancelled");
    await logAdminAction({ action: "order.cancel", entityType: "order", entityId: orderId, summary: `Cancelled: ${reason}${input.restock ? " (restocked)" : ""}` });
    done(orderId);
    return { ok: true, message: `Order cancelled.${refundNote}` };
  });
}

export async function reconcilePaymentAction(orderId: string): Promise<ActionResult> {
  return runAdminAction("orders.read", async () => {
    const outcome = await reconcileOrderPayment(id.parse(orderId));
    done(orderId);
    return {
      ok: true,
      message:
        outcome === "paid"
          ? "The payment provider confirms this order was paid. The order has been updated."
          : outcome === "not_paid"
            ? "The payment provider shows no successful payment for this order."
            : "Couldn't get an answer from the payment provider yet. Please try again later.",
    };
  });
}

export async function resendEmailAction(orderId: string, template: OrderTemplate): Promise<ActionResult> {
  return runAdminAction("orders.write", async ({ db }) => {
    id.parse(orderId);
    z.enum(["order_placed", "payment_confirmed", "order_shipped", "order_delivered", "order_cancelled", "refund_issued", "invoice"]).parse(template);
    // Allow re-sending once-only templates by clearing their earlier log entry.
    check(await db.from("orders").select("id").eq("id", orderId).single());
    await requireServiceDb().from("notification_log").delete().eq("order_id", orderId).eq("template", template);
    // A button press means the owner wants it sent, even if automatic invoices are off.
    await notifyOrder(orderId, template, template === "invoice" ? { force: true } : undefined);
    const { data } = await db
      .from("notification_log")
      .select("status, error")
      .eq("order_id", orderId)
      .eq("template", template)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    done(orderId);
    if (data?.status === "sent") return { ok: true, message: "Email sent." };
    if (data?.status === "skipped") return { ok: false, message: "Email isn't configured yet (or this email type is switched off)." };
    return { ok: false, message: `Email failed: ${data?.error ?? "unknown error"}` };
  });
}

export async function createShiprocketShipmentAction(orderId: string): Promise<ActionResult> {
  return runAdminAction("orders.write", async ({ db }) => {
    if (!isShiprocketConfigured()) throw new UserFacingError("Shiprocket is not connected.");
    const settings = await getAllSettings();
    if (!settings.shiprocket.pickup_location) throw new UserFacingError("Add your Shiprocket pickup location name in Settings → Shipping first.");
    const { data: order } = check(
      await db
        .from("orders")
        .select("id, order_number, created_at, customer_name, email, phone, shipping_address, payment_method, subtotal_paise, shipping_paise, discount_paise, total_weight_grams, status, order_items(title, sku, quantity, unit_price_paise)")
        .eq("id", id.parse(orderId))
        .single(),
    );
    if (order!.status !== "placed") throw new UserFacingError("Only confirmed orders can be shipped.");
    const a = order!.shipping_address as Record<string, string>;
    try {
      const result = await createShiprocketOrder({
        orderNumber: order!.order_number,
        orderDate: order!.created_at.slice(0, 16).replace("T", " "),
        pickupLocation: settings.shiprocket.pickup_location,
        customer: { name: order!.customer_name, email: order!.email, phone: order!.phone },
        address: { line1: a.line1, line2: [a.line2, a.landmark].filter(Boolean).join(", "), city: a.city, state: a.state, pincode: a.pincode },
        items: (order!.order_items ?? []).map((i) => ({ name: i.title, sku: i.sku ?? "SKU", units: i.quantity, sellingPrice: i.unit_price_paise / 100 })),
        paymentMethod: order!.payment_method === "cod" ? "COD" : "Prepaid",
        subTotal: order!.subtotal_paise / 100,
        shippingCharges: order!.shipping_paise / 100,
        discount: order!.discount_paise / 100,
        weightKg: Math.max(0.1, (order!.total_weight_grams || 100) / 1000),
        dimensionsCm: {
          length: settings.shiprocket.default_length_cm,
          breadth: settings.shiprocket.default_breadth_cm,
          height: settings.shiprocket.default_height_cm,
        },
      });
      check(
        await db.from("shipments").insert({
          order_id: orderId,
          provider: "shiprocket",
          provider_order_id: String(result.order_id),
          provider_shipment_id: String(result.shipment_id),
          awb_code: result.awb_code ?? null,
          carrier: result.courier_name ?? null,
          status: "pending",
        }),
      );
    } catch (e) {
      if (e instanceof ShiprocketError) throw new UserFacingError(`Shiprocket: ${e.message}`);
      throw e;
    }
    await logAdminAction({ action: "order.shiprocket_create", entityType: "order", entityId: orderId, summary: "Created Shiprocket order" });
    done(orderId);
    return { ok: true, message: "Order created in Shiprocket. Assign a courier/AWB in Shiprocket, then use “Sync tracking”." };
  });
}

export async function syncShiprocketAction(shipmentId: string): Promise<ActionResult> {
  return runAdminAction("orders.write", async ({ db }) => {
    const { data: shipment } = check(await db.from("shipments").select("id, order_id, provider_shipment_id").eq("id", id.parse(shipmentId)).single());
    if (!shipment?.provider_shipment_id) throw new UserFacingError("This shipment isn't linked to Shiprocket.");
    try {
      await syncShiprocketShipment(shipment.id);
    } catch (e) {
      if (e instanceof ShiprocketError) throw new UserFacingError(`Shiprocket: ${e.message}`);
      throw e;
    }
    done(shipment.order_id);
    return { ok: true, message: "Tracking synced from Shiprocket." };
  });
}

import "server-only";
import type { Json } from "@/lib/db/database.types";
import { getServiceDb } from "@/lib/db/client";
import {
  captureRazorpayPayment,
  fetchRazorpayOrderPayments,
  fetchRazorpayPayment,
  isRazorpayConfigured,
  type RazorpayPayment,
} from "@/lib/payments/razorpay";
import { logError, logInfo } from "@/lib/monitoring";
import { revalidateStorefront } from "@/lib/cache";
import { paymentMatchesOrder } from "./payment-validation";
import { notifyOrder } from "@/lib/notifications/order-notifications";

export type ConfirmResult =
  | "paid"
  | "already_paid"
  | "paid_needs_attention"
  | "amount_mismatch"
  | "pending"
  | "failed"
  | "invalid";

function minimalRaw(payment: RazorpayPayment): Json {
  return {
    id: payment.id,
    order_id: payment.order_id,
    status: payment.status,
    method: payment.method,
    amount: payment.amount,
    captured: payment.captured,
  };
}

/** Runs once an order becomes paid: emails + refreshing stock on the storefront. */
export async function afterOrderPaid(orderId: string) {
  revalidateStorefront();
  await notifyOrder(orderId, "payment_confirmed");
  await notifyOrder(orderId, "admin_new_order");
}

async function findOrderIdForRazorpayOrder(razorpayOrderId: string): Promise<string | null> {
  const admin = getServiceDb();
  if (!admin) return null;
  const { data, error } = await admin
    .from("payments")
    .select("order_id")
    .eq("provider", "razorpay")
    .eq("provider_order_id", razorpayOrderId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Could not load the order linked to this provider payment");
  return data?.order_id ?? null;
}

/**
 * Confirms a Razorpay payment by asking Razorpay directly (server-to-server),
 * captures it if it was only authorised, and marks our order as paid.
 * Idempotent: safe to call from the browser callback, the webhook and the
 * reconciliation job for the same payment.
 */
export async function confirmRazorpayPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  payment?: RazorpayPayment;
}): Promise<{ result: ConfirmResult; orderId: string | null }> {
  const admin = getServiceDb();
  if (!admin) return { result: "invalid", orderId: null };

  const orderId = await findOrderIdForRazorpayOrder(input.razorpayOrderId);
  if (!orderId) return { result: "invalid", orderId: null };

  const { data: order, error: orderError } = await admin.from("orders").select("total_paise").eq("id", orderId).maybeSingle();
  if (orderError || !order) return { result: "pending", orderId };
  const expected = { paymentId: input.razorpayPaymentId, providerOrderId: input.razorpayOrderId, totalPaise: order.total_paise };
  let payment = input.payment ?? (await fetchRazorpayPayment(input.razorpayPaymentId));
  const validation = paymentMatchesOrder(payment, expected);
  if (validation !== "valid") {
    logError("payments.confirm", new Error("Payment identity, amount or currency does not match the order"), {
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
    });
    if (validation === "amount_mismatch") {
      const { error } = await admin.from("order_events").insert({ order_id: orderId, type: "payment_mismatch", visibility: "internal", message: "Provider payment amount or currency did not match this order. Review the payment in Razorpay before fulfilment; no capture was attempted by this confirmation." });
      if (error) return { result: "pending", orderId };
    }
    return { result: validation, orderId };
  }

  if (payment.status === "authorized") {
    try {
      payment = await captureRazorpayPayment(payment.id, expected.totalPaise);
    } catch (error) {
      // A simultaneous webhook may have captured it. Re-fetch provider state.
      logError("payments.capture", error, { orderId });
      payment = await fetchRazorpayPayment(input.razorpayPaymentId);
    }
    const capturedValidation = paymentMatchesOrder(payment, expected);
    if (capturedValidation !== "valid") return { result: capturedValidation, orderId };
  }

  if (payment.status === "captured" || payment.status === "refunded") {
    const { data, error } = await admin.rpc("mark_order_paid", {
      p_order_id: orderId,
      p_provider_order_id: input.razorpayOrderId,
      p_provider_payment_id: payment.id,
      p_amount_paise: payment.amount,
      p_method: payment.method ?? "",
      p_payment_status: "captured",
      p_raw: minimalRaw(payment),
    });
    if (error) {
      logError("payments.mark_paid", error, { orderId });
      return { result: "pending", orderId };
    }
    const result = data as ConfirmResult;
    if (result === "paid" || result === "paid_needs_attention") {
      logInfo("payments", "Order paid", { orderId, result });
      await afterOrderPaid(orderId);
    }
    return { result, orderId };
  }

  if (payment.status === "failed") {
    const { error } = await admin.rpc("record_payment_failure", {
      p_order_id: orderId,
      p_provider_order_id: input.razorpayOrderId,
      p_provider_payment_id: payment.id,
      p_error_code: payment.error_code ?? "",
      p_error_description: payment.error_description ?? "Payment failed",
      p_raw: minimalRaw(payment),
    });
    if (error) return { result: "pending", orderId };
    return { result: "failed", orderId };
  }

  return { result: "pending", orderId };
}

/**
 * Asks Razorpay whether any payment for this order succeeded.
 * Used before expiring an unpaid order, and from the admin order page.
 */
export async function reconcileOrderPayment(orderId: string): Promise<"paid" | "not_paid" | "unknown"> {
  const admin = getServiceDb();
  if (!admin) return "unknown";
  const { data: rows, error } = await admin
    .from("payments")
    .select("provider_order_id")
    .eq("order_id", orderId)
    .eq("provider", "razorpay")
    .not("provider_order_id", "is", null);
  if (error) return "unknown";
  const razorpayOrderIds = [...new Set((rows ?? []).map((r) => r.provider_order_id!))];
  if (razorpayOrderIds.length === 0) return "not_paid";
  if (!isRazorpayConfigured()) return "unknown";
  try {
    for (const razorpayOrderId of razorpayOrderIds) {
      const payments = await fetchRazorpayOrderPayments(razorpayOrderId);
      const success = payments.find((p) => p.status === "captured" || p.status === "authorized");
      if (success) {
        const { result } = await confirmRazorpayPayment({
          razorpayOrderId,
          razorpayPaymentId: success.id,
          payment: success,
        });
        if (result === "amount_mismatch") return "unknown";
        if (["paid", "already_paid", "paid_needs_attention"].includes(result)) return "paid";
      }
    }
    return "not_paid";
  } catch (error) {
    logError("payments.reconcile", error, { orderId });
    return "unknown";
  }
}

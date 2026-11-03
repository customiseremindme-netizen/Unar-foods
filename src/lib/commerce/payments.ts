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
import { getPhonePeOrderStatus, isPhonePeConfigured } from "@/lib/payments/phonepe";
import { logError, logInfo } from "@/lib/monitoring";
import { revalidateStorefront } from "@/lib/cache";
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
  const { data } = await admin
    .from("payments")
    .select("order_id")
    .eq("provider", "razorpay")
    .eq("provider_order_id", razorpayOrderId)
    .limit(1)
    .maybeSingle();
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

  let payment = input.payment ?? (await fetchRazorpayPayment(input.razorpayPaymentId));
  if (payment.order_id !== input.razorpayOrderId) {
    logError("payments.confirm", new Error("Payment does not belong to this order"), {
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
    });
    return { result: "invalid", orderId };
  }

  if (payment.status === "authorized") {
    payment = await captureRazorpayPayment(payment.id, payment.amount);
  }

  if (payment.status === "captured" || payment.status === "refunded") {
    const { data, error } = await admin.rpc("mark_order_paid", {
      p_order_id: orderId,
      p_provider: "razorpay",
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
    await admin.rpc("record_payment_failure", {
      p_order_id: orderId,
      p_provider_order_id: input.razorpayOrderId,
      p_provider_payment_id: payment.id,
      p_error_code: payment.error_code ?? "",
      p_error_description: payment.error_description ?? "Payment failed",
      p_raw: minimalRaw(payment),
    });
    return { result: "failed", orderId };
  }

  return { result: "pending", orderId };
}

/**
 * Confirms a PhonePe payment attempt by asking PhonePe for its status
 * (server-to-server) and marks our order as paid. Idempotent: safe to call
 * from the customer's return, the webhook and the reconciliation job.
 */
export async function confirmPhonePePayment(merchantOrderId: string): Promise<{ result: ConfirmResult; orderId: string | null }> {
  const admin = getServiceDb();
  if (!admin) return { result: "invalid", orderId: null };
  const { data: row } = await admin
    .from("payments")
    .select("order_id")
    .eq("provider", "phonepe")
    .eq("provider_order_id", merchantOrderId)
    .limit(1)
    .maybeSingle();
  if (!row) return { result: "invalid", orderId: null };
  const orderId = row.order_id;
  const status = await getPhonePeOrderStatus(merchantOrderId);
  const raw = { orderId: status.orderId, state: status.state, amount: status.amount } as Json;
  if (status.state === "COMPLETED") {
    const done = status.paymentDetails?.find((d) => d.state === "COMPLETED") ?? status.paymentDetails?.[0];
    const { data, error } = await admin.rpc("mark_order_paid", {
      p_order_id: orderId,
      p_provider: "phonepe",
      p_provider_order_id: merchantOrderId,
      p_provider_payment_id: done?.transactionId || status.orderId,
      p_amount_paise: status.amount,
      p_method: done?.paymentMode ?? "",
      p_payment_status: "captured",
      p_raw: raw,
    });
    if (error) {
      logError("payments.phonepe_mark_paid", error, { orderId });
      return { result: "pending", orderId };
    }
    const result = data as ConfirmResult;
    if (result === "paid" || result === "paid_needs_attention") {
      logInfo("payments", "Order paid (PhonePe)", { orderId, result });
      await afterOrderPaid(orderId);
    }
    return { result, orderId };
  }
  if (status.state === "FAILED") {
    await admin.rpc("record_payment_failure", {
      p_order_id: orderId,
      p_provider: "phonepe",
      p_provider_order_id: merchantOrderId,
      p_provider_payment_id: `${merchantOrderId}:failed`,
      p_error_code: status.errorCode ?? status.paymentDetails?.[0]?.errorCode ?? "",
      p_error_description: "Payment was not completed on PhonePe",
      p_raw: raw,
    });
    return { result: "failed", orderId };
  }
  return { result: "pending", orderId };
}

/**
 * Staff confirm a payment the customer sent to the shop's own UPI ID
 * (checked in their Google Pay / PhonePe Business app).
 */
export async function confirmManualUpiPayment(orderId: string, reference: string): Promise<ConfirmResult> {
  const admin = getServiceDb();
  if (!admin) return "invalid";
  const { data: order } = await admin.from("orders").select("order_number, total_paise, payment_method").eq("id", orderId).maybeSingle();
  if (!order || order.payment_method !== "upi_manual") return "invalid";
  const { data, error } = await admin.rpc("mark_order_paid", {
    p_order_id: orderId,
    p_provider: "upi_manual",
    p_provider_order_id: order.order_number,
    p_provider_payment_id: `upi:${reference}`,
    p_amount_paise: order.total_paise,
    p_method: "upi",
    p_payment_status: "captured",
    p_raw: { reference } as Json,
  });
  if (error) throw new Error(error.message);
  const result = data as ConfirmResult;
  if (result === "paid" || result === "paid_needs_attention") await afterOrderPaid(orderId);
  return result;
}

/**
 * Asks the payment provider whether any payment for this order succeeded.
 * Used before expiring an unpaid order, and from the admin order page.
 */
export async function reconcileOrderPayment(orderId: string): Promise<"paid" | "not_paid" | "unknown"> {
  const admin = getServiceDb();
  if (!admin) return "unknown";
  const { data: rows } = await admin
    .from("payments")
    .select("provider, provider_order_id")
    .eq("order_id", orderId)
    .in("provider", ["razorpay", "phonepe"])
    .not("provider_order_id", "is", null);
  const attempts = [...new Map((rows ?? []).map((r) => [`${r.provider}:${r.provider_order_id}`, r])).values()];
  if (attempts.length === 0) return "not_paid";
  try {
    for (const attempt of attempts) {
      if (attempt.provider === "phonepe") {
        if (!isPhonePeConfigured()) continue;
        const { result } = await confirmPhonePePayment(attempt.provider_order_id!);
        if (["paid", "already_paid", "paid_needs_attention", "amount_mismatch"].includes(result)) return "paid";
        if (result === "pending") return "unknown";
        continue;
      }
      if (!isRazorpayConfigured()) continue;
      const payments = await fetchRazorpayOrderPayments(attempt.provider_order_id!);
      const success = payments.find((p) => p.status === "captured" || p.status === "authorized");
      if (success) {
        const { result } = await confirmRazorpayPayment({
          razorpayOrderId: attempt.provider_order_id!,
          razorpayPaymentId: success.id,
          payment: success,
        });
        if (["paid", "already_paid", "paid_needs_attention", "amount_mismatch"].includes(result)) return "paid";
      }
    }
    return "not_paid";
  } catch (error) {
    logError("payments.reconcile", error, { orderId });
    return "unknown";
  }
}

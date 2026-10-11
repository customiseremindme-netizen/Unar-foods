/** Check provider values before taking any irreversible payment action. */
export function paymentMatchesOrder(
  payment: { id: string; order_id: string | null; amount: number; currency: string },
  expected: { paymentId: string; providerOrderId: string; totalPaise: number },
): "valid" | "invalid" | "amount_mismatch" {
  if (payment.id !== expected.paymentId || payment.order_id !== expected.providerOrderId) return "invalid";
  if (payment.currency !== "INR" || !Number.isSafeInteger(payment.amount) || payment.amount <= 0 || payment.amount !== expected.totalPaise) return "amount_mismatch";
  return "valid";
}

/** A mismatched amount must never be reported as a successful payment to checkout. */
export function browserPaymentStatus(result: string): "paid" | "pending" | "failed" | "invalid" {
  if (["paid", "already_paid", "paid_needs_attention"].includes(result)) return "paid";
  if (result === "amount_mismatch" || result === "invalid") return "invalid";
  return result === "failed" ? "failed" : "pending";
}

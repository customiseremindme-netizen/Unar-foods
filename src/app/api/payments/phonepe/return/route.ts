import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getRequestSiteUrl } from "@/lib/site-url";
import { confirmPhonePePayment } from "@/lib/commerce/payments";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { logError } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

/**
 * PhonePe sends the customer back here after the payment page. We never
 * trust the return itself: the payment is checked with PhonePe (server to
 * server) before the order counts as paid. Then the customer sees their order.
 */
export async function GET(request: Request) {
  const site = await getRequestSiteUrl();
  const url = new URL(request.url);
  const orderNumber = url.searchParams.get("order") ?? "";
  const merchantOrderId = url.searchParams.get("m") ?? "";
  if (!/^UNAR-\d{4,}$/.test(orderNumber) || !merchantOrderId.startsWith(`${orderNumber}-`) || merchantOrderId.length > 63) {
    return NextResponse.redirect(`${site}/`);
  }
  const jar = await cookies();
  const cookieName = `unar_pay_${orderNumber}`;
  const token = jar.get(cookieName)?.value ?? "";
  let payment = "pending";
  if (await checkRateLimit("paymentVerify", await getClientIp())) {
    try {
      const { result } = await confirmPhonePePayment(merchantOrderId);
      payment = ["paid", "already_paid", "paid_needs_attention", "amount_mismatch"].includes(result) ? "success" : result === "failed" ? "failed" : "pending";
    } catch (error) {
      // PhonePe unreachable: the webhook / reconciliation job will finish the job.
      logError("payments.phonepe_return", error, { order: orderNumber });
    }
  }
  if (payment === "success") jar.delete({ name: cookieName, path: "/api/payments/phonepe" });
  const params = new URLSearchParams({ payment });
  if (token) params.set("token", token);
  return NextResponse.redirect(`${site}/orders/${orderNumber}?${params.toString()}`);
}

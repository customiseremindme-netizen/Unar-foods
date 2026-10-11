import { NextResponse } from "next/server";
import { z } from "zod";
import { getRazorpayEnv } from "@/lib/env";
import { verifyPaymentSignature } from "@/lib/payments/razorpay";
import { browserPaymentStatus } from "@/lib/commerce/payment-validation";
import { confirmRazorpayPayment } from "@/lib/commerce/payments";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/security/request";
import { logError } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]{6,40}$/),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
  order_number: z.string().regex(/^UNAR-\d{4,}$/),
  token: z.string().max(100).optional(),
});

/**
 * Called by the browser after Razorpay Checkout reports success.
 * We verify the cryptographic signature AND confirm the payment with
 * Razorpay's API before marking the order paid. The browser is never trusted
 * on its own.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (!(await checkRateLimit("paymentVerify", await getClientIp()))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const env = getRazorpayEnv();
  if (!env) return NextResponse.json({ error: "Payments not configured" }, { status: 503 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const body = parsed.data;

  const valid = verifyPaymentSignature({
    orderId: body.razorpay_order_id,
    paymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
    keySecret: env.keySecret,
  });
  const tokenQuery = body.token ? `?token=${encodeURIComponent(body.token)}` : "";
  const redirectTo = `/orders/${body.order_number}${tokenQuery}`;
  if (!valid) {
    logError("payments.verify", new Error("Invalid payment signature"), { order: body.order_number });
    return NextResponse.json({ status: "invalid", redirectTo }, { status: 400 });
  }

  try {
    const { result } = await confirmRazorpayPayment({
      razorpayOrderId: body.razorpay_order_id,
      razorpayPaymentId: body.razorpay_payment_id,
    });
    const status = browserPaymentStatus(result);
    return NextResponse.json({ status, redirectTo });
  } catch (error) {
    // Razorpay unreachable: the webhook / reconciliation job will finish the job.
    logError("payments.verify", error, { order: body.order_number });
    return NextResponse.json({ status: "pending", redirectTo });
  }
}

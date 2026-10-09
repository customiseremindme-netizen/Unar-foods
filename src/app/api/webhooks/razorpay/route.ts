import { NextResponse } from "next/server";
import type { Json } from "@/lib/db/database.types";
import { getRazorpayEnv } from "@/lib/env";
import { getServiceDb } from "@/lib/db/client";
import { verifyWebhookSignature, type RazorpayPayment } from "@/lib/payments/razorpay";
import { confirmRazorpayPayment } from "@/lib/commerce/payments";
import { sha256Hex } from "@/lib/security/tokens";
import { logError, logInfo } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

type WebhookBody = {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayPayment };
    order?: { entity?: { id: string } };
    refund?: { entity?: { id: string; payment_id: string; amount: number; status: string } };
  };
};

/**
 * Razorpay webhook (configure in Razorpay Dashboard → Webhooks).
 * - The signature is verified over the RAW request body.
 * - Every event is stored once (unique event id), so retries are harmless.
 * - Payment events are confirmed with the same idempotent function the
 *   checkout uses, so stock and orders can never be processed twice.
 */
export async function POST(request: Request) {
  const env = getRazorpayEnv();
  const admin = getServiceDb();
  if (!env?.webhookSecret || !admin) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!signature || !verifyWebhookSignature({ rawBody, signature, webhookSecret: env.webhookSecret })) {
    logError("webhook.razorpay", new Error("Invalid webhook signature"));
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = request.headers.get("x-razorpay-event-id") || sha256Hex(rawBody);
  const eventType = body.event ?? "unknown";

  const { data: inserted, error: insertError } = await admin
    .from("webhook_events")
    .insert({ provider: "razorpay", event_id: eventId, event_type: eventType, payload: body as unknown as Json })
    .select("id")
    .maybeSingle();
  if (insertError) {
    if (insertError.code === "23505") {
      // Already received. Only re-process if the earlier attempt failed.
      const { data: previous } = await admin
        .from("webhook_events")
        .select("id, status")
        .eq("provider", "razorpay")
        .eq("event_id", eventId)
        .maybeSingle();
      if (!previous || previous.status !== "failed") return NextResponse.json({ ok: true, duplicate: true });
      return process(eventType, body, previous.id);
    }
    logError("webhook.razorpay.store", insertError);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
  return process(eventType, body, inserted!.id);
}

async function process(eventType: string, body: WebhookBody, rowId: string) {
  const admin = getServiceDb()!;
  const finish = async (status: "processed" | "ignored" | "failed", error?: string) => {
    await admin
      .from("webhook_events")
      .update({ status, error: error ?? null, processed_at: new Date().toISOString() })
      .eq("id", rowId);
  };

  try {
    const payment = body.payload?.payment?.entity;
    switch (eventType) {
      case "payment.captured":
      case "payment.authorized":
      case "order.paid": {
        if (!payment?.order_id) {
          await finish("ignored", "No payment in payload");
          break;
        }
        const { result } = await confirmRazorpayPayment({
          razorpayOrderId: payment.order_id,
          razorpayPaymentId: payment.id,
          payment: eventType === "payment.authorized" ? undefined : payment,
        });
        logInfo("webhook.razorpay", "payment event handled", { eventType, result });
        await finish(result === "invalid" ? "ignored" : "processed", result === "invalid" ? "Order not found for this payment" : undefined);
        break;
      }
      case "payment.failed": {
        if (!payment?.order_id) {
          await finish("ignored");
          break;
        }
        const { data: row } = await admin
          .from("payments")
          .select("order_id")
          .eq("provider_order_id", payment.order_id)
          .limit(1)
          .maybeSingle();
        if (row) {
          await admin.rpc("record_payment_failure", {
            p_order_id: row.order_id,
            p_provider_order_id: payment.order_id,
            p_provider_payment_id: payment.id,
            p_error_code: payment.error_code ?? "",
            p_error_description: payment.error_description ?? "Payment failed",
            p_raw: { id: payment.id, status: payment.status, method: payment.method } as Json,
          });
        }
        await finish(row ? "processed" : "ignored");
        break;
      }
      case "refund.processed":
      case "refund.failed": {
        const refund = body.payload?.refund?.entity;
        if (refund?.id) {
          await admin.rpc("update_refund_status", {
            p_provider_refund_id: refund.id,
            p_status: eventType === "refund.processed" ? "processed" : "failed",
          });
        }
        await finish("processed");
        break;
      }
      default:
        await finish("ignored");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("webhook.razorpay.process", error, { eventType });
    await finish("failed", error instanceof Error ? error.message : "Unknown error");
    // 500 tells Razorpay to retry later.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

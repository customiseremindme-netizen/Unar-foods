import { NextResponse } from "next/server";
import type { Json } from "@/lib/db/database.types";
import { getServiceDb } from "@/lib/db/client";
import { getPhonePeEnv } from "@/lib/env";
import { verifyPhonePeWebhook } from "@/lib/payments/phonepe";
import { confirmPhonePePayment } from "@/lib/commerce/payments";
import { sha256Hex } from "@/lib/security/tokens";
import { logError, logInfo } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

type PhonePeWebhook = { event?: string; type?: string; payload?: { merchantOrderId?: string; originalMerchantOrderId?: string; orderId?: string; state?: string } };

/**
 * PhonePe webhook (PhonePe Business dashboard → Developer settings →
 * Webhook, with the username and password from PHONEPE_WEBHOOK_USERNAME /
 * PHONEPE_WEBHOOK_PASSWORD). The message only tells us *which* payment
 * changed: the result is always fetched from PhonePe's status API.
 */
export async function POST(request: Request) {
  const env = getPhonePeEnv();
  const admin = getServiceDb();
  if (!env?.webhookUsername || !admin) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!verifyPhonePeWebhook(request.headers.get("authorization"))) {
    logError("webhook.phonepe", new Error("Invalid webhook authorization"));
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rawBody = await request.text();
  let body: PhonePeWebhook;
  try {
    body = JSON.parse(rawBody) as PhonePeWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const eventType = (body.event ?? body.type ?? "unknown").slice(0, 60);
  const { data: stored, error: insertError } = await admin
    .from("webhook_events")
    .insert({ provider: "phonepe", event_id: sha256Hex(rawBody).slice(0, 64), event_type: eventType, payload: body as unknown as Json })
    .select("id")
    .single();
  if (insertError) {
    if (insertError.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    logError("webhook.phonepe.store", insertError);
    return NextResponse.json({ error: "Could not store event" }, { status: 500 });
  }
  const merchantOrderId = body.payload?.merchantOrderId ?? body.payload?.originalMerchantOrderId;
  let status = "ignored";
  let error: string | null = null;
  if (merchantOrderId && /^UNAR-\d{4,}-[a-z0-9]+$/i.test(merchantOrderId) && /order|checkout/i.test(eventType)) {
    try {
      status = (await confirmPhonePePayment(merchantOrderId)).result;
    } catch (e) {
      error = (e as Error).message.slice(0, 500);
      status = "failed";
      logError("webhook.phonepe.confirm", e);
    }
  }
  await admin.from("webhook_events").update({ status: error ? "failed" : "processed", error, processed_at: new Date().toISOString() }).eq("id", stored!.id);
  logInfo("webhook.phonepe", "processed", { eventType, status });
  if (error) return NextResponse.json({ error: "Try again" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

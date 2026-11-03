import { NextResponse } from "next/server";
import { getServiceDb } from "@/lib/db/client";
import { getShiprocketWebhookToken } from "@/lib/env";
import { safeEqual } from "@/lib/security/tokens";
import { syncShiprocketShipment } from "@/lib/shipping/tracking-sync";
import { logError, logInfo } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

/**
 * Courier tracking updates from Shiprocket (Shiprocket → Settings → API →
 * Webhooks; this address deliberately doesn't contain "shiprocket", which
 * Shiprocket doesn't allow). Shiprocket sends the token we chose in the
 * "x-api-key" header. The update only tells us which shipment changed —
 * the tracking itself is fetched from Shiprocket again.
 */
export async function POST(request: Request) {
  const expected = getShiprocketWebhookToken();
  const admin = getServiceDb();
  if (!expected || !admin) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!safeEqual(request.headers.get("x-api-key") ?? "", expected)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { awb?: string | number; shipment_id?: string | number; current_status?: string } | null;
  const awb = body?.awb ? String(body.awb).slice(0, 80) : "";
  const shipmentRef = body?.shipment_id ? String(body.shipment_id).slice(0, 100) : "";
  if (!awb && !shipmentRef) return NextResponse.json({ ok: true, ignored: true });
  let query = admin.from("shipments").select("id").eq("provider", "shiprocket").limit(1);
  query = awb ? query.or(`awb_code.eq.${awb.replace(/[^A-Za-z0-9-]/g, "")},tracking_number.eq.${awb.replace(/[^A-Za-z0-9-]/g, "")}`) : query.eq("provider_shipment_id", shipmentRef.replace(/[^A-Za-z0-9-]/g, ""));
  const { data: shipment } = await query.maybeSingle();
  // Always answer 200 so Shiprocket doesn't keep retrying shipments that aren't ours.
  if (!shipment) return NextResponse.json({ ok: true, unknown: true });
  try {
    const { status } = await syncShiprocketShipment(shipment.id);
    logInfo("webhook.courier", "synced", { status });
  } catch (error) {
    logError("webhook.courier", error);
  }
  return NextResponse.json({ ok: true });
}

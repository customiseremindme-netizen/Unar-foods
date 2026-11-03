import "server-only";
import { requireServiceDb } from "@/lib/db/client";
import { notifyOrder, trackingExtra } from "@/lib/notifications/order-notifications";
import { revalidateStorefront } from "@/lib/cache";
import { logError } from "@/lib/monitoring";
import { trackShiprocketShipment } from "./shiprocket";

export type TrackingStatus = "in_transit" | "out_for_delivery" | "delivered" | null;

/** Turns Shiprocket's status text into ours (null = nothing to change yet). */
export function shiprocketStatus(currentStatus: string | null | undefined): TrackingStatus {
  const s = (currentStatus ?? "").toLowerCase();
  if (s.includes("deliver") && !s.includes("out") && !s.includes("undeliver") && !s.includes("rto")) return "delivered";
  if (s.includes("out for")) return "out_for_delivery";
  if (s.includes("transit") || s.includes("shipped") || s.includes("picked") || s.includes("dispatch")) return "in_transit";
  return null;
}

/**
 * Fetches a Shiprocket shipment's tracking (the courier's answer is always
 * fetched from Shiprocket itself), stores it, and moves the order along:
 * on the way → "Shipped" (customer emailed once), delivered → "Delivered".
 * Used by the dashboard button, the courier webhook and the scheduled job.
 */
export async function syncShiprocketShipment(shipmentId: string): Promise<{ status: TrackingStatus; orderId: string }> {
  const db = requireServiceDb();
  const { data: shipment } = await db.from("shipments").select("id, order_id, provider_shipment_id").eq("id", shipmentId).maybeSingle();
  if (!shipment?.provider_shipment_id) throw new Error("This shipment isn't linked to Shiprocket.");
  const tracking = await trackShiprocketShipment(shipment.provider_shipment_id);
  const t = tracking.tracking_data;
  const track = t?.shipment_track?.[0];
  const status = shiprocketStatus(track?.current_status);
  const trackingUrl = t?.track_url && /^https:\/\//.test(t.track_url) ? t.track_url : undefined;
  await db
    .from("shipments")
    .update({
      awb_code: track?.awb_code || undefined,
      tracking_number: track?.awb_code || undefined,
      carrier: track?.courier_name || undefined,
      tracking_url: trackingUrl,
      ...(status ? { status } : {}),
      ...(status === "delivered" ? { delivered_at: new Date().toISOString() } : {}),
    })
    .eq("id", shipment.id);
  const activities = (t?.shipment_track_activities ?? []).slice(0, 20);
  if (activities.length > 0) {
    await db.from("shipment_events").delete().eq("shipment_id", shipment.id).eq("source", "shiprocket");
    await db.from("shipment_events").insert(
      activities.map((a) => ({
        shipment_id: shipment.id,
        status: (a["sr-status-label"] ?? "update").slice(0, 60),
        description: a.activity?.slice(0, 300) ?? null,
        location: a.location?.slice(0, 120) ?? null,
        occurred_at: new Date(a.date).toString() === "Invalid Date" ? new Date().toISOString() : new Date(a.date).toISOString(),
        source: "shiprocket" as const,
      })),
    );
  }

  // Move the order along (never backwards) and tell the customer.
  const { data: order } = await db.from("orders").select("status, fulfillment_status").eq("id", shipment.order_id).maybeSingle();
  if (order?.status === "placed" && status) {
    const next = status === "delivered" ? "delivered" : "shipped";
    const already = next === "shipped" ? ["shipped", "delivered", "returned"] : ["delivered", "returned"];
    if (!already.includes(order.fulfillment_status)) {
      const { error } = await db.rpc("set_fulfillment_status", {
        p_order_id: shipment.order_id,
        p_status: next,
        p_message: next === "shipped" ? "Your order is on its way." : "Your order was delivered.",
        p_customer_visible: true,
      });
      if (error) logError("tracking.fulfilment", error, { orderId: shipment.order_id });
      else {
        await notifyOrder(
          shipment.order_id,
          next === "shipped" ? "order_shipped" : "order_delivered",
          trackingExtra({ carrier: track?.courier_name, trackingNumber: track?.awb_code, trackingUrl: trackingUrl ?? null }),
        );
        revalidateStorefront();
      }
    }
  }
  return { status, orderId: shipment.order_id };
}

/** Scheduled job: refresh Shiprocket shipments that aren't delivered yet (newest first). */
export async function syncOpenShiprocketShipments(limit = 30): Promise<number> {
  const db = requireServiceDb();
  const since = new Date(Date.now() - 45 * 86_400_000).toISOString();
  const { data } = await db
    .from("shipments")
    .select("id")
    .eq("provider", "shiprocket")
    .not("provider_shipment_id", "is", null)
    .not("status", "in", "(delivered,cancelled,returned)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);
  let synced = 0;
  for (const s of data ?? []) {
    try {
      await syncShiprocketShipment(s.id);
      synced++;
    } catch (error) {
      logError("tracking.sync", error, { shipmentId: s.id });
    }
  }
  return synced;
}

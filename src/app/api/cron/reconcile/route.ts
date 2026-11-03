import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/env";
import { getServiceDb } from "@/lib/db/client";
import { releaseExpiredReservations } from "@/lib/commerce/checkout";
import { revalidateStorefront } from "@/lib/cache";
import { safeEqual } from "@/lib/security/tokens";
import { logError, logInfo } from "@/lib/monitoring";
import { deleteOrphanReviewMedia } from "@/lib/reviews/media";
import { isShiprocketConfigured } from "@/lib/shipping/shiprocket";
import { syncOpenShiprocketShipments } from "@/lib/shipping/tracking-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled job, called daily by a Hostinger cron job with the header
 * `Authorization: Bearer <CRON_SECRET>` (see docs/SETUP_GUIDE.md, Part 5).
 * - Checks unpaid orders whose payment window expired with Razorpay, marks
 *   them paid if the payment actually succeeded, otherwise releases stock.
 * - Cleans up old rate-limit counters, expired sign-in sessions and review
 *   uploads that were never attached to a review.
 * - Refreshes courier tracking (Shiprocket) for shipments on the way.
 */
export async function GET(request: Request) {
  const secret = getCronSecret();
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await releaseExpiredReservations(50);
  await getServiceDb()?.rpc("cleanup_rate_limits");
  // Review photos/videos uploaded but never attached to a review.
  await deleteOrphanReviewMedia().catch((e) => logError("cron.review_media", e));
  // Courier tracking for shipments not yet delivered (Shiprocket).
  const tracked = isShiprocketConfigured() ? await syncOpenShiprocketShipments(30).catch((e) => (logError("cron.tracking", e), 0)) : 0;
  if (result.released > 0 || result.paid > 0) revalidateStorefront();
  logInfo("cron.reconcile", "done", { ...result, tracked });
  return NextResponse.json({ ok: true, ...result, tracked });
}

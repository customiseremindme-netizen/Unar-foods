import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/env";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { releaseExpiredReservations } from "@/lib/commerce/checkout";
import { revalidateStorefront } from "@/lib/cache";
import { safeEqual } from "@/lib/security/tokens";
import { logInfo } from "@/lib/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled job (see vercel.json). Vercel sends `Authorization: Bearer
 * <CRON_SECRET>` automatically when the CRON_SECRET variable is set.
 * - Checks unpaid orders whose payment window expired with Razorpay, marks
 *   them paid if the payment actually succeeded, otherwise releases stock.
 * - Cleans up old rate-limit counters.
 */
export async function GET(request: Request) {
  const secret = getCronSecret();
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await releaseExpiredReservations(50);
  await getAdminSupabase()?.rpc("cleanup_rate_limits");
  if (result.released > 0 || result.paid > 0) revalidateStorefront();
  logInfo("cron.reconcile", "done", result);
  return NextResponse.json({ ok: true, ...result });
}

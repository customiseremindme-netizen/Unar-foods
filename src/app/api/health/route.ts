import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/db/health";
import { describeSetupKey, getConfiguredSiteUrl, getEmailEnv, getRazorpayEnv } from "@/lib/env";
import { getRequestSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/**
 * Setup / uptime check. Open https://YOUR-SITE/api/health to see whether the
 * website can reach its database and which services are connected.
 * Shows only yes/no answers — never keys or customer data.
 */
export async function GET() {
  const db = await checkDatabase();
  const body = {
    ...db,
    site_url: await getRequestSiteUrl(),
    site_url_setting: getConfiguredSiteUrl() ? "set" : "automatic (set NEXT_PUBLIC_SITE_URL once your domain is connected)",
    setup_key: describeSetupKey(),
    payments: getRazorpayEnv()?.mode ?? "not set up",
    email: getEmailEnv()?.provider ?? "not set up",
  };
  return NextResponse.json(body, { status: db.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

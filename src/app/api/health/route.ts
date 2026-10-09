import { NextResponse } from "next/server";
import { getPublicSupabase } from "@/lib/supabase/public";
import { getEmailEnv, getRazorpayEnv, getSiteUrl, getSupabaseSecretKey } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Setup / uptime check. Open https://YOUR-SITE/api/health to see whether the
 * website can reach its database and which services are connected.
 * Shows only yes/no answers — never keys or customer data.
 */
export async function GET() {
  const services = {
    site_url: getSiteUrl(),
    server_key: getSupabaseSecretKey() ? "set" : "missing",
    payments: getRazorpayEnv()?.mode ?? "not set up",
    email: getEmailEnv()?.provider ?? "not set up",
  };
  const supabase = getPublicSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        database: "not configured",
        fix: "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to your hosting environment variables, then redeploy.",
        ...services,
      },
      { status: 503 },
    );
  }
  const { data, error } = await supabase.from("settings").select("key").eq("key", "store").limit(1);
  let database = "ok";
  let fix: string | undefined;
  if (error) {
    const missingTables = error.code === "PGRST205" || error.code === "42P01" || /does not exist|could not find the table/i.test(error.message);
    const badKey = /api key|jwt|apikey|unauthor/i.test(error.message);
    if (missingTables) {
      database = "connected, but the tables are missing";
      fix = "Run supabase/setup/all-migrations.sql once in Supabase → SQL Editor (see the setup guide, Part 2.2).";
    } else if (badKey) {
      database = "connected, but the key was refused";
      fix = "Check NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is the publishable key of the same project, then redeploy.";
    } else {
      database = "unreachable";
      fix = "Check NEXT_PUBLIC_SUPABASE_URL (it looks like https://xxxx.supabase.co) and that the Supabase project is not paused.";
    }
  } else if (!data?.length) {
    database = "connected, but the starter data is missing";
    fix = "Run supabase/setup/all-migrations.sql once in Supabase → SQL Editor.";
  }
  const ok = database === "ok";
  return NextResponse.json({ ok, database, ...(fix ? { fix } : {}), ...services }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

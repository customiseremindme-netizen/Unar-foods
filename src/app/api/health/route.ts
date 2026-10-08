import { NextResponse } from "next/server";
import { getPublicSupabase } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

/** Simple uptime check: is the app running and can it reach the database? */
export async function GET() {
  const supabase = getPublicSupabase();
  if (!supabase) return NextResponse.json({ ok: false, database: "not configured" }, { status: 503 });
  const { error } = await supabase.from("settings").select("key").limit(1);
  return NextResponse.json({ ok: !error, database: error ? "unreachable" : "ok" }, { status: error ? 503 : 200 });
}

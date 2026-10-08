import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSafeInternalPath } from "@/lib/validation/common";

export const dynamic = "force-dynamic";

/** Finishes email confirmation / password-reset links (PKCE code exchange). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/account";
  const next = isSafeInternalPath(nextParam) ? nextParam : "/account";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? { error: true };
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}

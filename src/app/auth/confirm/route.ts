import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSafeInternalPath } from "@/lib/validation/common";

export const dynamic = "force-dynamic";

const TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Token-hash email links (recommended Supabase email templates — see the
 * setup guide). Works even if the link is opened in a different browser.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const nextParam = url.searchParams.get("next") ?? (type === "recovery" ? "/reset-password" : "/account");
  const next = isSafeInternalPath(nextParam) ? nextParam : "/account";

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createSupabaseServerClient();
    const result = await supabase?.auth.verifyOtp({ type, token_hash: tokenHash });
    if (result && !result.error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGoogleEnv } from "@/lib/env";
import { getRequestSiteUrl } from "@/lib/site-url";
import { cookieIsSecure } from "@/lib/auth/accounts";
import { GOOGLE_COOKIE, googleAuthUrl, newGoogleStart } from "@/lib/auth/google";
import { isSafeInternalPath } from "@/lib/validation/common";

export const dynamic = "force-dynamic";

/** "Continue with Google": sends the visitor to Google's sign-in page. */
export async function GET(request: Request) {
  const site = await getRequestSiteUrl();
  const env = getGoogleEnv();
  if (!env) return NextResponse.redirect(`${site}/login?error=google_off`);
  const nextParam = new URL(request.url).searchParams.get("next") ?? "";
  const next = nextParam && isSafeInternalPath(nextParam) && !nextParam.startsWith("/auth") ? nextParam : "/account";
  const start = newGoogleStart(next);
  (await cookies()).set(GOOGLE_COOKIE, JSON.stringify(start), {
    httpOnly: true,
    secure: await cookieIsSecure(),
    sameSite: "lax",
    path: "/auth/google",
    maxAge: 10 * 60,
  });
  return NextResponse.redirect(googleAuthUrl(env, start, `${site}/auth/google/callback`));
}

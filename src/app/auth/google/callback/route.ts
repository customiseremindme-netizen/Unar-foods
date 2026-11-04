import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGoogleEnv } from "@/lib/env";
import { getRequestSiteUrl } from "@/lib/site-url";
import { isDatabaseConfigured } from "@/lib/db/client";
import { findOrCreateGoogleUser, startSession } from "@/lib/auth/accounts";
import { exchangeGoogleCode, GOOGLE_COOKIE, type GoogleStart } from "@/lib/auth/google";
import { resolveCart } from "@/lib/commerce/cart";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { safeEqual } from "@/lib/security/tokens";
import { logError } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

/** Google sends the visitor back here after they choose their account. */
export async function GET(request: Request) {
  const site = await getRequestSiteUrl();
  const fail = (reason: string) => NextResponse.redirect(`${site}/login?error=${reason}`);
  const env = getGoogleEnv();
  if (!env || !isDatabaseConfigured()) return fail("google_off");
  const url = new URL(request.url);
  const jar = await cookies();
  const raw = jar.get(GOOGLE_COOKIE)?.value;
  jar.delete({ name: GOOGLE_COOKIE, path: "/auth/google" });
  if (url.searchParams.get("error")) return fail("google_cancelled");
  let start: GoogleStart | null = null;
  try {
    start = raw ? (JSON.parse(raw) as GoogleStart) : null;
  } catch {
    start = null;
  }
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  // The answer must belong to the sign-in this browser started.
  if (!start || !state || !code || !safeEqual(state, start.state)) return fail("google");
  if (!(await checkRateLimit("googleSignIn", await getClientIp()))) return fail("google_busy");
  let needsTwoStep = false;
  try {
    const profile = await exchangeGoogleCode(env, { code, verifier: start.verifier, nonce: start.nonce, redirectUri: `${site}/auth/google/callback` });
    const userId = await findOrCreateGoogleUser(profile);
    needsTwoStep = (await startSession(userId)).needsTwoStep;
    await resolveCart({ create: false, userId }).catch((e) => logError("auth.merge_cart", e));
  } catch (error) {
    logError("auth.google", error);
    return fail("google");
  }
  // Google proves the email, not the second step: staff with two-step still enter their code.
  if (needsTwoStep) return NextResponse.redirect(`${site}/login/two-step?next=${encodeURIComponent(start.next)}`);
  return NextResponse.redirect(`${site}${start.next}`);
}

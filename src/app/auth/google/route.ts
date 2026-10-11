import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGoogleEnv } from "@/lib/env";
import { isDatabaseConfigured } from "@/lib/db/client";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { randomToken, sha256Hex } from "@/lib/security/tokens";
import { isSafeInternalPath } from "@/lib/validation/common";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const config = getGoogleEnv();
  if (!config || !isDatabaseConfigured()) return NextResponse.json({ error: "Google sign-in is not set up yet." }, { status: 503 });
  if (!(await checkRateLimit("googleLogin", await getClientIp()))) return NextResponse.json({ error: "Too many sign-in attempts. Please try again later." }, { status: 429 });
  const rawNext = new URL(request.url).searchParams.get("next");
  const next = rawNext && isSafeInternalPath(rawNext) && !rawNext.startsWith("/auth") ? rawNext : "/account";
  const state = randomToken(32), verifier = randomToken(48), nonce = randomToken(32);
  const secure = new URL(config.redirectUri).protocol === "https:";
  (await cookies()).set("unar_google_oauth", JSON.stringify({ state, verifier, nonce, next, expires: Date.now() + 10 * 60000 }), { httpOnly: true, secure, sameSite: "lax", path: "/auth/google", maxAge: 600 });
  const challenge = Buffer.from(sha256Hex(verifier), "hex").toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", scope: "openid email profile", state, nonce, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account" }).toString();
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

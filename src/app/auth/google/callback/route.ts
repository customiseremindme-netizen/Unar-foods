import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGoogleEnv } from "@/lib/env";
import { exchangeGoogleCode, findOrCreateGoogleCustomer } from "@/lib/auth/google";
import { startSession } from "@/lib/auth/accounts";
import { resolveCart } from "@/lib/commerce/cart";
import { safeEqual } from "@/lib/security/tokens";
import { isSafeInternalPath } from "@/lib/validation/common";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const config = getGoogleEnv();
  if (!config) return NextResponse.json({ error: "Google sign-in is not set up yet." }, { status: 503 });
  const store = await cookies(), raw = store.get("unar_google_oauth")?.value;
  store.set("unar_google_oauth", "", { path: "/auth/google", maxAge: 0 });
  const origin = new URL(config.redirectUri).origin;
  const fail = () => NextResponse.redirect(new URL("/login?error=google", origin));
  try {
    const params = new URL(request.url).searchParams;
    const attempt = raw ? JSON.parse(raw) : null;
    const state = params.get("state"), code = params.get("code");
    if (!attempt || typeof attempt.state !== "string" || !state || !safeEqual(state, attempt.state) || !code || code.length > 4000
      || typeof attempt.expires !== "number" || attempt.expires <= Date.now()
      || typeof attempt.verifier !== "string" || typeof attempt.nonce !== "string" || params.has("error")) return fail();
    const identity = await exchangeGoogleCode(code, attempt.verifier, attempt.nonce);
    const userId = await findOrCreateGoogleCustomer(identity);
    await startSession(userId);
    await resolveCart({ create: false, userId }).catch(() => undefined);
    const next = typeof attempt.next === "string" && isSafeInternalPath(attempt.next) && !attempt.next.startsWith("/auth") ? attempt.next : "/account";
    const response = NextResponse.redirect(new URL(next, origin));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    // Never log authorization codes, tokens, identity payloads or provider secrets.
    return fail();
  }
}

import "server-only";
import { createHash } from "node:crypto";
import type { GoogleEnv } from "@/lib/env";
import { randomToken } from "@/lib/security/tokens";

/** Short-lived cookie holding the values that tie Google's answer to this browser. */
export const GOOGLE_COOKIE = "unar_google";

export type GoogleStart = { state: string; verifier: string; nonce: string; next: string };

export function newGoogleStart(next: string): GoogleStart {
  return { state: randomToken(24), verifier: randomToken(48), nonce: randomToken(24), next };
}

export function googleAuthUrl(env: GoogleEnv, start: GoogleStart, redirectUri: string): string {
  const challenge = createHash("sha256").update(start.verifier).digest("base64url");
  const params = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: start.state,
    nonce: start.nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${env.authUrl}?${params.toString()}`;
}

export type GoogleProfile = { subject: string; email: string; name: string | null };

/**
 * Swaps the one-time code for Google's ID token (directly with Google over
 * HTTPS, using the client secret and the PKCE verifier) and checks it was
 * issued for this shop, is current, matches this sign-in and has a verified email.
 */
export async function exchangeGoogleCode(env: GoogleEnv, input: { code: string; verifier: string; nonce: string; redirectUri: string }): Promise<GoogleProfile> {
  const res = await fetch(env.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: env.clientId,
      client_secret: env.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
      code_verifier: input.verifier,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const body = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok || !body.id_token) throw new Error(`Google token exchange failed: ${body.error ?? res.status}`);
  const parts = body.id_token.split(".");
  if (parts.length !== 3) throw new Error("Malformed ID token");
  const claims = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as Record<string, unknown>;
  const issuers = ["https://accounts.google.com", "accounts.google.com"];
  const testIssuer = env.tokenUrl.startsWith("https://oauth2.googleapis.com") ? null : new URL(env.tokenUrl).origin;
  if (!issuers.includes(String(claims.iss)) && String(claims.iss) !== testIssuer) throw new Error("Wrong issuer");
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(env.clientId)) throw new Error("Token was issued for another app");
  if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) throw new Error("Token expired");
  if (claims.nonce !== input.nonce) throw new Error("Nonce mismatch");
  if (claims.email_verified !== true && claims.email_verified !== "true") throw new Error("Google email not verified");
  if (typeof claims.sub !== "string" || typeof claims.email !== "string") throw new Error("Missing account details");
  return { subject: claims.sub, email: claims.email, name: typeof claims.name === "string" ? claims.name : null };
}

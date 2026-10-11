import "server-only";
import { getReadyPool } from "@/lib/db/install";
import { getGoogleEnv } from "@/lib/env";
import { persistVerifiedGoogleCustomer } from "./google-customer";
import { verifyGoogleIdToken, type GoogleClaims, type GoogleJwk } from "./google-token";

let cachedKeys: { expires: number; keys: GoogleJwk[] } | undefined;

export async function exchangeGoogleCode(code: string, verifier: string, nonce: string): Promise<GoogleClaims> {
  const config = getGoogleEnv();
  if (!config) throw new Error("Google sign-in is not configured");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: "authorization_code", code_verifier: verifier }),
    cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Google code exchange failed");
  const data = await response.json();
  if (typeof data.id_token !== "string") throw new Error("Missing Google identity token");
  if (!cachedKeys || cachedKeys.expires <= Date.now()) {
    const jwks = await fetch("https://www.googleapis.com/oauth2/v3/certs", { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!jwks.ok) throw new Error("Google verification keys unavailable");
    const result = await jwks.json();
    if (!Array.isArray(result.keys)) throw new Error("Invalid Google verification keys");
    cachedKeys = { keys: result.keys, expires: Date.now() + 5 * 60000 };
  }
  return verifyGoogleIdToken(data.id_token, cachedKeys.keys, { audience: config.clientId, nonce });
}

export async function findOrCreateGoogleCustomer(identity: GoogleClaims): Promise<string> {
  return persistVerifiedGoogleCustomer(await getReadyPool(), identity);
}

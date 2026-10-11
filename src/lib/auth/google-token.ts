import { createPublicKey, verify, type JsonWebKey } from "node:crypto";

export type GoogleClaims = { sub: string; email: string; email_verified: true; name?: string };
export type GoogleJwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

/** Verify Google's signature and every claim that binds this token to this login. */
export function verifyGoogleIdToken(token: string, keys: GoogleJwk[], expected: { audience: string; nonce: string; now?: number }): GoogleClaims {
  if (token.length > 16000) throw new Error("Invalid Google token");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid Google token");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  const jwk = keys.find((key) => key.kid === header.kid && key.kty === "RSA" && (!key.alg || key.alg === "RS256") && (!key.use || key.use === "sig"));
  if (header.alg !== "RS256" || !jwk || !verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(parts[2], "base64url"))) throw new Error("Invalid Google signature");
  const now = expected.now ?? Math.floor(Date.now() / 1000);
  if (!["https://accounts.google.com", "accounts.google.com"].includes(claims.iss)
    || claims.aud !== expected.audience || (claims.azp && claims.azp !== expected.audience)
    || typeof claims.exp !== "number" || claims.exp <= now
    || typeof claims.iat !== "number" || claims.iat > now + 60
    || claims.nonce !== expected.nonce || claims.email_verified !== true
    || typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255
    || typeof claims.email !== "string" || claims.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)) throw new Error("Invalid Google claims");
  return { sub: claims.sub, email: claims.email.trim().toLowerCase(), email_verified: true, name: typeof claims.name === "string" ? claims.name.slice(0, 120) : undefined };
}

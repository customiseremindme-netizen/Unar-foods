import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGoogleIdToken } from "@/lib/auth/google-token";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const keys = [{ ...publicKey.export({ format: "jwk" }), kid: "trusted-key", alg: "RS256", use: "sig" }];
const claims = { iss: "https://accounts.google.com", aud: "unar-client", sub: "google-user", email: "customer@example.com", email_verified: true, nonce: "login-nonce", iat: 1000, exp: 4600 };
const expected = { audience: "unar-client", nonce: "login-nonce", now: 1100 };
function token(patch = {}, header = {}) {
  const body = [Buffer.from(JSON.stringify({ alg: "RS256", kid: "trusted-key", ...header })).toString("base64url"), Buffer.from(JSON.stringify({ ...claims, ...patch })).toString("base64url")].join(".");
  return `${body}.${sign("RSA-SHA256", Buffer.from(body), privateKey).toString("base64url")}`;
}

describe("Google identity verification", () => {
  it("accepts only a signed Google identity bound to this client and login", () => {
    expect(verifyGoogleIdToken(token(), keys, expected)).toMatchObject({ sub: "google-user", email: "customer@example.com", email_verified: true });
  });
  it.each([
    { iss: "https://attacker.example" }, { aud: "another-client" }, { azp: "another-client" },
    { nonce: "another-login" }, { email_verified: false }, { email_verified: "true" },
    { exp: 1100 }, { iat: 5000 }, { sub: "" }, { email: "invalid" },
  ])("rejects unsafe claims: %j", (patch) => {
    expect(() => verifyGoogleIdToken(token(patch), keys, expected)).toThrow();
  });
  it("requires Gmail or a matching verified hosted domain for existing-account linking", () => {
    expect(verifyGoogleIdToken(token(), keys, expected).authoritativeEmail).toBe(false);
    expect(verifyGoogleIdToken(token({ email: "customer@gmail.com" }), keys, expected).authoritativeEmail).toBe(true);
    expect(verifyGoogleIdToken(token({ hd: "example.com" }), keys, expected).authoritativeEmail).toBe(true);
    expect(verifyGoogleIdToken(token({ hd: "another.example" }), keys, expected).authoritativeEmail).toBe(false);
  });
  it("rejects signature tampering, unknown keys and algorithm confusion", () => {
    expect(() => verifyGoogleIdToken(token().replace(/.$/, "!"), keys, expected)).toThrow();
    expect(() => verifyGoogleIdToken(token({}, { kid: "unknown" }), keys, expected)).toThrow();
    expect(() => verifyGoogleIdToken(token({}, { alg: "HS256" }), keys, expected)).toThrow();
    expect(() => verifyGoogleIdToken("broken", keys, expected)).toThrow();
  });
});

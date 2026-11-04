import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, newRecoveryCodes, newTotpSecret, otpauthUri, totpCode, verifyTotp } from "@/lib/auth/totp";

// RFC 6238 test vectors (SHA-1, secret "12345678901234567890"), last 6 digits.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("two-step codes (TOTP)", () => {
  it("matches the RFC 6238 test vectors", () => {
    expect(totpCode(RFC_SECRET, Math.floor(59 / 30))).toBe("287082");
    expect(totpCode(RFC_SECRET, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totpCode(RFC_SECRET, Math.floor(1234567890 / 30))).toBe("005924");
    expect(totpCode(RFC_SECRET, Math.floor(2000000000 / 30))).toBe("279037");
  });

  it("round-trips base32", () => {
    const secret = newTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
  });

  it("accepts the current code (and one step of clock drift) once, rejects old and reused codes", () => {
    const secret = newTotpSecret();
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 30000);
    const code = totpCode(secret, step);
    expect(verifyTotp(secret, code, null, now)).toBe(step);
    expect(verifyTotp(secret, code, step, now)).toBeNull(); // replay
    expect(verifyTotp(secret, totpCode(secret, step - 1), null, now)).toBe(step - 1);
    expect(verifyTotp(secret, totpCode(secret, step - 3), null, now)).toBeNull();
    expect(verifyTotp(secret, "12345", null, now)).toBeNull();
    expect(verifyTotp(secret, "abcdef", null, now)).toBeNull();
  });

  it("builds an authenticator QR address and unique recovery codes", () => {
    expect(otpauthUri({ secret: "ABC", account: "owner@unar.in", issuer: "UNAR" })).toMatch(/^otpauth:\/\/totp\/UNAR%3Aowner%40unar\.in\?secret=ABC&issuer=UNAR/);
    const codes = newRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/);
  });
});

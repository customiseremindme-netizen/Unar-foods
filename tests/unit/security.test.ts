import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verifyPaymentSignature, verifyWebhookSignature } from "@/lib/payments/razorpay";
import { safeEqual, sha256Hex } from "@/lib/security/tokens";
import { formatINR, paiseToRupeesInput, rupeesToPaise } from "@/lib/money";
import {
  addressSchema,
  emailSchema,
  isSafeInternalPath,
  linkSchema,
  normalizeIndianPhone,
  phoneSchema,
  pincodeSchema,
  slugify,
} from "@/lib/validation/common";
import { parseSetting } from "@/lib/settings/schema";

describe("Razorpay signatures", () => {
  const secret = "test_secret";
  it("accepts a valid payment signature and rejects tampering", () => {
    const signature = createHmac("sha256", secret).update("order_1|pay_1").digest("hex");
    expect(verifyPaymentSignature({ orderId: "order_1", paymentId: "pay_1", signature, keySecret: secret })).toBe(true);
    expect(verifyPaymentSignature({ orderId: "order_2", paymentId: "pay_1", signature, keySecret: secret })).toBe(false);
    expect(verifyPaymentSignature({ orderId: "order_1", paymentId: "pay_1", signature: "00", keySecret: secret })).toBe(false);
  });

  it("verifies webhook bodies byte-for-byte", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    const signature = createHmac("sha256", "whsec").update(body).digest("hex");
    expect(verifyWebhookSignature({ rawBody: body, signature, webhookSecret: "whsec" })).toBe(true);
    expect(verifyWebhookSignature({ rawBody: body + " ", signature, webhookSecret: "whsec" })).toBe(false);
  });

  it("compares strings safely", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(sha256Hex("x")).toHaveLength(64);
  });
});

describe("money", () => {
  it("formats rupees", () => {
    expect(formatINR(14900)).toBe("₹149");
    expect(formatINR(14950)).toBe("₹149.50");
    expect(formatINR(129900)).toBe("₹1,299");
  });
  it("parses admin input", () => {
    expect(rupeesToPaise("149")).toBe(14900);
    expect(rupeesToPaise("₹1,299.5")).toBe(129950);
    expect(rupeesToPaise("12.345")).toBeNull();
    expect(rupeesToPaise("-5")).toBeNull();
    expect(rupeesToPaise("abc")).toBeNull();
    expect(paiseToRupeesInput(14950)).toBe("149.50");
    expect(paiseToRupeesInput(14900)).toBe("149");
  });
});

describe("validation", () => {
  it("normalises Indian mobile numbers", () => {
    expect(normalizeIndianPhone("+91 99946 57693")).toBe("9994657693");
    expect(normalizeIndianPhone("09994657693")).toBe("9994657693");
    expect(phoneSchema.safeParse("98765 43210").success).toBe(true);
    expect(phoneSchema.safeParse("12345").success).toBe(false);
    expect(phoneSchema.safeParse("5876543210").success).toBe(false);
  });
  it("validates PIN codes", () => {
    expect(pincodeSchema.safeParse("641664").success).toBe(true);
    expect(pincodeSchema.safeParse("041664").success).toBe(false);
    expect(pincodeSchema.safeParse("64166").success).toBe(false);
  });
  it("validates emails", () => {
    expect(emailSchema.parse("  Test@Example.COM ")).toBe("test@example.com");
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
  it("validates full addresses", () => {
    const ok = addressSchema.safeParse({
      full_name: "Priya Kumar",
      phone: "9876543210",
      line1: "12 Main Road",
      city: "Palladam",
      state: "Tamil Nadu",
      pincode: "641664",
    });
    expect(ok.success).toBe(true);
    expect(addressSchema.safeParse({ full_name: "P", phone: "1", line1: "", city: "", state: "Nowhere", pincode: "1" }).success).toBe(false);
  });
  it("only allows safe links", () => {
    expect(isSafeInternalPath("/shop")).toBe(true);
    expect(isSafeInternalPath("//evil.com")).toBe(false);
    expect(isSafeInternalPath("javascript:alert(1)")).toBe(false);
    expect(linkSchema.safeParse("https://instagram.com/unar").success).toBe(true);
    expect(linkSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(linkSchema.safeParse("http://insecure.com").success).toBe(false);
  });
  it("makes slugs", () => {
    expect(slugify("Banana Chewy — Dry Fruits & Seeds")).toBe("banana-chewy-dry-fruits-and-seeds");
  });
});

describe("settings", () => {
  it("falls back to defaults for invalid values without losing valid ones", () => {
    const theme = parseSetting("theme", { forest: "red", olive: "#112233" });
    expect(theme.forest).toBe("#2E4E36");
    expect(theme.olive).toBe("#112233");
  });
  it("rejects invalid GSTINs", () => {
    expect(parseSetting("tax", { gstin: "123" }).gstin).toBe("");
    expect(parseSetting("tax", { gstin: "33ABCDE1234F1Z5" }).gstin).toBe("33ABCDE1234F1Z5");
  });
});

describe("test-only API overrides", () => {
  it("are ignored on the live (production) deployment", async () => {
    const { getRazorpayEnv } = await import("@/lib/env");
    const saved = { ...process.env };
    process.env.RAZORPAY_KEY_ID = "rzp_live_x";
    process.env.RAZORPAY_KEY_SECRET = "secret";
    process.env.RAZORPAY_API_BASE_URL = "http://127.0.0.1:4010/v1";
    process.env.VERCEL_ENV = "production";
    expect(getRazorpayEnv()?.apiBaseUrl).toBe("https://api.razorpay.com/v1");
    process.env.VERCEL_ENV = "preview";
    expect(getRazorpayEnv()?.apiBaseUrl).toBe("http://127.0.0.1:4010/v1");
    // Other hosts (e.g. Hostinger): any production build ignores them too.
    delete process.env.VERCEL_ENV;
    (process.env as Record<string, string>).NODE_ENV = "production";
    expect(getRazorpayEnv()?.apiBaseUrl).toBe("https://api.razorpay.com/v1");
    process.env = saved;
  });
});

describe("email provider selection", () => {
  it("uses Hostinger-style SMTP when Resend isn't configured", async () => {
    const { getEmailEnv } = await import("@/lib/env");
    const saved = { ...process.env };
    delete process.env.RESEND_API_KEY;
    process.env.SMTP_HOST = "smtp.hostinger.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "orders@example.in";
    process.env.SMTP_PASSWORD = "x";
    process.env.EMAIL_FROM = "UNAR <orders@example.in>";
    const env = getEmailEnv();
    expect(env?.provider).toBe("smtp");
    expect(env && env.provider === "smtp" && env.smtp.secure).toBe(true);
    process.env.RESEND_API_KEY = "re_x";
    expect(getEmailEnv()?.provider).toBe("resend");
    process.env = saved;
  });
});

describe("hosting panel placeholders", () => {
  it("treats 'none', empty and quoted values sensibly", async () => {
    const { getEmailEnv, getRazorpayEnv, getSetupKey } = await import("@/lib/env");
    const { getDbConfig } = await import("@/lib/db/pool");
    const saved = { ...process.env };
    process.env.RAZORPAY_KEY_ID = "none";
    process.env.RAZORPAY_KEY_SECRET = "none";
    expect(getRazorpayEnv()).toBeNull();
    delete process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "none";
    process.env.SMTP_HOST = "smtp.hostinger.com";
    process.env.SMTP_USER = "none";
    process.env.SMTP_PASSWORD = "none";
    expect(getEmailEnv()).toBeNull();
    delete process.env.DATABASE_URL;
    process.env.DB_HOST = "localhost";
    process.env.DB_NAME = "PASTE_DATABASE_NAME";
    process.env.DB_USER = "u1_unar";
    process.env.DB_PASSWORD = "secret";
    expect(getDbConfig()).toBeNull();
    process.env.DB_NAME = '"u1_unar"';
    process.env.DB_PORT = "none";
    expect(getDbConfig()).toEqual({ host: "localhost", port: 3306, database: "u1_unar", user: "u1_unar", password: "secret" });
    process.env.SETUP_KEY = "short";
    expect(getSetupKey()).toBeNull();
    // A template value left in place must never work as a secret.
    process.env.SETUP_KEY = "PASTE_A_LONG_SECRET_PHRASE";
    expect(getSetupKey()).toBeNull();
    // The setup check reports status words only, never the value.
    const { describeSetting, describeSetupKey } = await import("@/lib/env");
    expect(describeSetupKey()).toMatch(/^still the PASTE_ template text/);
    process.env.SETUP_KEY = "a-long-enough-setup-phrase";
    expect(describeSetupKey()).toBe("set");
    process.env.SETUP_KEY = "tooshort";
    expect(describeSetupKey()).toMatch(/^too short/);
    process.env.DB_USER = "none";
    expect(describeSetting("DB_USER")).toBe("none");
    delete process.env.DB_PASSWORD;
    expect(describeSetting("DB_PASSWORD")).toBe("missing");
    process.env.DB_NAME = '"u1_unar"';
    expect(describeSetting("DB_NAME")).toBe("set");
    process.env.SETUP_KEY = "a-long-enough-setup-phrase";
    expect(getSetupKey()).toBe("a-long-enough-setup-phrase");
    process.env = saved;
  });
});

import "server-only";

/**
 * Central place for reading environment variables (server side).
 *
 * Every integration is optional at build time so the site can be deployed
 * before all accounts are set up. Each helper returns `null` when the
 * integration is not configured, and the UI shows an honest
 * "not configured yet" state instead of pretending it works.
 */

/** Words a hosting panel may force us to type for a setting that isn't used yet. */
const PLACEHOLDERS = new Set(["none", "-", "n/a", "na", "null", "undefined", "empty", "skip", "not set", "notset"]);

function read(name: string): string | undefined {
  let value = process.env[name]?.trim();
  if (!value) return undefined;
  // Some panels keep quotes from an imported .env file: "value" → value
  if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) value = value.slice(1, -1).trim();
  if (!value || PLACEHOLDERS.has(value.toLowerCase())) return undefined;
  // Template values that were never replaced (e.g. PASTE_A_LONG_SECRET_PHRASE) are not real settings.
  if (/^PASTE_/i.test(value)) return undefined;
  return value;
}

/**
 * Test-only overrides (e.g. RAZORPAY_API_BASE_URL pointing at a local mock)
 * are ignored on the live Vercel deployment, so a mistaken setting can never
 * send payments or emails anywhere except the real providers.
 */
function testOverride(name: string): string | undefined {
  if (process.env.VERCEL_ENV === "production") return undefined;
  // Any production build (Vercel, Hostinger, …) ignores them unless a test run explicitly allows it.
  if (process.env.NODE_ENV === "production" && process.env.UNAR_ALLOW_TEST_OVERRIDES !== "1") return undefined;
  return read(name);
}

/** NEXT_PUBLIC_SITE_URL, if it is set to a real http(s) address. */
export function getConfiguredSiteUrl(): string | null {
  const explicit = read("NEXT_PUBLIC_SITE_URL");
  if (!explicit || !/^https?:\/\/[^\s/]+/i.test(explicit)) return null;
  return explicit.replace(/\/+$/, "");
}

export function getSiteUrl(): string {
  const explicit = getConfiguredSiteUrl();
  if (explicit) return explicit;
  const vercelProd = read("VERCEL_PROJECT_PRODUCTION_URL");
  if (vercelProd) return `https://${vercelProd}`;
  const vercel = read("VERCEL_URL");
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/**
 * SETUP_KEY: a long secret phrase the owner chooses. It unlocks the one-time
 * /setup page that creates the first owner account (only while no owner
 * exists). Ignored if shorter than 12 characters.
 */
export function getSetupKey(): string | null {
  const key = read("SETUP_KEY");
  return key && key.length >= 12 ? key : null;
}

/**
 * For the setup check (/api/health): says whether a setting is filled in,
 * WITHOUT ever revealing its value.
 */
export function describeSetting(name: string): "set" | "missing" | "none" | "still the PASTE_ template text" {
  const raw = process.env[name]?.trim().replace(/^(["'])(.*)\1$/, "$2").trim();
  if (!raw) return "missing";
  if (/^PASTE_/i.test(raw)) return "still the PASTE_ template text";
  if (PLACEHOLDERS.has(raw.toLowerCase())) return "none";
  return "set";
}

export function describeSetupKey(): string {
  const status = describeSetting("SETUP_KEY");
  if (status !== "set") return `${status} (only needed to create the owner account)`;
  return getSetupKey() ? "set" : "too short — use at least 12 characters";
}

export type RazorpayEnv = {
  keyId: string;
  keySecret: string;
  webhookSecret: string | null;
  apiBaseUrl: string;
  mode: "test" | "live";
};

export function getRazorpayEnv(): RazorpayEnv | null {
  const keyId = read("RAZORPAY_KEY_ID");
  const keySecret = read("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) return null;
  return {
    keyId,
    keySecret,
    webhookSecret: read("RAZORPAY_WEBHOOK_SECRET") ?? null,
    // Overridable only so automated tests can point at a local mock server (never in production).
    apiBaseUrl: (testOverride("RAZORPAY_API_BASE_URL") ?? "https://api.razorpay.com/v1").replace(/\/+$/, ""),
    mode: keyId.startsWith("rzp_live_") ? "live" : "test",
  };
}

export type SmtpEnv = { host: string; port: number; secure: boolean; user: string; password: string };

/**
 * Order emails can go out through EITHER:
 *  - Resend (RESEND_API_KEY + EMAIL_FROM), or
 *  - any mailbox's SMTP server, e.g. Hostinger Email
 *    (SMTP_HOST=smtp.hostinger.com, SMTP_PORT=465, SMTP_USER, SMTP_PASSWORD).
 * Resend is used when both are set.
 */
export type EmailEnv =
  | { provider: "resend"; from: string; resendApiKey: string; apiBaseUrl: string }
  | { provider: "smtp"; from: string; smtp: SmtpEnv };

export function getEmailEnv(): EmailEnv | null {
  const from = read("EMAIL_FROM");
  const resendApiKey = read("RESEND_API_KEY");
  if (resendApiKey && from) {
    return {
      provider: "resend",
      resendApiKey,
      from,
      apiBaseUrl: (testOverride("RESEND_API_BASE_URL") ?? "https://api.resend.com").replace(/\/+$/, ""),
    };
  }
  const host = read("SMTP_HOST");
  const user = read("SMTP_USER");
  const password = read("SMTP_PASSWORD");
  if (host && user && password) {
    const port = Number(read("SMTP_PORT") ?? 465) || 465;
    return { provider: "smtp", from: from ?? user, smtp: { host, port, secure: port === 465, user, password } };
  }
  return null;
}

export type ShiprocketEnv = { email: string; password: string; apiBaseUrl: string };

export function getShiprocketEnv(): ShiprocketEnv | null {
  const email = read("SHIPROCKET_EMAIL");
  const password = read("SHIPROCKET_PASSWORD");
  if (!email || !password) return null;
  return {
    email,
    password,
    apiBaseUrl: (testOverride("SHIPROCKET_API_BASE_URL") ?? "https://apiv2.shiprocket.in/v1/external").replace(/\/+$/, ""),
  };
}

export function getCronSecret(): string | null {
  return read("CRON_SECRET") ?? null;
}

/** Shows the last 4 characters of a secret, never the whole value. */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "not set";
  if (value.length <= 8) return "••••";
  return `••••${value.slice(-4)}`;
}

import "server-only";

/**
 * Central place for reading environment variables (server side).
 *
 * Every integration is optional at build time so the site can be deployed
 * before all accounts are set up. Each helper returns `null` when the
 * integration is not configured, and the UI shows an honest
 * "not configured yet" state instead of pretending it works.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
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

export function getSiteUrl(): string {
  const explicit = read("NEXT_PUBLIC_SITE_URL");
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercelProd = read("VERCEL_PROJECT_PRODUCTION_URL");
  if (vercelProd) return `https://${vercelProd}`;
  const vercel = read("VERCEL_URL");
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export type SupabaseEnv = { url: string; publishableKey: string };

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = read("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey =
    read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function getSupabaseSecretKey(): string | null {
  return read("SUPABASE_SECRET_KEY") ?? read("SUPABASE_SERVICE_ROLE_KEY") ?? null;
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

import "server-only";
import { createHash } from "node:crypto";
import { getPhonePeEnv, type PhonePeEnv } from "@/lib/env";
import { safeEqual } from "@/lib/security/tokens";

/**
 * Minimal PhonePe Payment Gateway client (Standard Checkout, version 2):
 * get an access token, start a payment (PhonePe hosts the payment page),
 * check an order's status, and refund. The client secret never leaves the
 * server. Payment results are always confirmed with the status call — never
 * from what the browser or a webhook says alone.
 */

export class PhonePeError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "PhonePeError";
  }
}

export type PhonePeOrderState = "PENDING" | "COMPLETED" | "FAILED";

export type PhonePeOrderStatus = {
  orderId: string;
  state: PhonePeOrderState;
  amount: number;
  paymentDetails?: { transactionId?: string; paymentMode?: string; amount?: number; state?: string; errorCode?: string; detailedErrorCode?: string }[];
  errorCode?: string;
};

const globalForPhonePe = globalThis as unknown as { __phonepeToken?: { value: string; expiresAt: number; key: string } };

async function accessToken(env: PhonePeEnv): Promise<string> {
  const key = `${env.authUrl}|${env.clientId}`;
  const cached = globalForPhonePe.__phonepeToken;
  if (cached && cached.key === key && cached.expiresAt - 60_000 > Date.now()) return cached.value;
  const res = await fetch(env.authUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_version: env.clientVersion,
      client_secret: env.clientSecret,
      grant_type: "client_credentials",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_at?: number; code?: string; message?: string };
  if (!res.ok || !body.access_token) throw new PhonePeError(body.message ?? "Could not sign in to PhonePe", res.status, body.code);
  const expiresAt = typeof body.expires_at === "number" ? body.expires_at * (body.expires_at < 1e12 ? 1000 : 1) : Date.now() + 10 * 60_000;
  globalForPhonePe.__phonepeToken = { value: body.access_token, expiresAt, key };
  return body.access_token;
}

async function call<T>(env: PhonePeEnv, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const token = await accessToken(env);
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method,
    headers: { Authorization: `O-Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { code?: string; message?: string };
  if (!res.ok) throw new PhonePeError(json.message ?? `PhonePe error ${res.status}`, res.status, json.code);
  return json;
}

function requireEnv(): PhonePeEnv {
  const env = getPhonePeEnv();
  if (!env) throw new PhonePeError("PhonePe is not configured", 503);
  return env;
}

export const isPhonePeConfigured = () => getPhonePeEnv() !== null;

/** A new, unique id for one payment attempt (PhonePe allows letters, digits, "-" and "_", up to 63). */
export function newMerchantOrderId(orderNumber: string): string {
  return `${orderNumber}-${Date.now().toString(36)}`.slice(0, 63);
}

/** Starts a payment; the customer is sent to `redirectUrl` (PhonePe's payment page). */
export async function createPhonePePayment(input: { merchantOrderId: string; amountPaise: number; redirectUrl: string; orderNumber: string; expireAfterSeconds: number }) {
  const env = requireEnv();
  return call<{ orderId: string; state: string; expireAt: number; redirectUrl: string }>(env, "POST", "/checkout/v2/pay", {
    merchantOrderId: input.merchantOrderId,
    amount: input.amountPaise,
    expireAfter: Math.max(300, Math.min(3600, input.expireAfterSeconds)),
    metaInfo: { udf1: input.orderNumber },
    paymentFlow: {
      type: "PG_CHECKOUT",
      message: `Order ${input.orderNumber}`,
      merchantUrls: { redirectUrl: input.redirectUrl },
    },
  });
}

/** The authoritative answer: has this payment attempt been paid? */
export async function getPhonePeOrderStatus(merchantOrderId: string): Promise<PhonePeOrderStatus> {
  const env = requireEnv();
  return call<PhonePeOrderStatus>(env, "GET", `/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status?details=false`);
}

export async function refundPhonePePayment(input: { merchantRefundId: string; merchantOrderId: string; amountPaise: number }) {
  const env = requireEnv();
  return call<{ refundId: string; amount: number; state: string }>(env, "POST", "/payments/v2/refund", {
    merchantRefundId: input.merchantRefundId,
    originalMerchantOrderId: input.merchantOrderId,
    amount: input.amountPaise,
  });
}

/**
 * PhonePe signs webhooks with SHA256("username:password") — the username and
 * password the owner chose when adding the webhook in the PhonePe dashboard.
 */
export function verifyPhonePeWebhook(authorization: string | null): boolean {
  const env = getPhonePeEnv();
  if (!env?.webhookUsername || !env.webhookPassword || !authorization) return false;
  const expected = createHash("sha256").update(`${env.webhookUsername}:${env.webhookPassword}`).digest("hex");
  return safeEqual(authorization.replace(/^SHA256\s+/i, "").trim().toLowerCase(), expected);
}

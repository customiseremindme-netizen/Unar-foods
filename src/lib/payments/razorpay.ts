import "server-only";
import { getRazorpayEnv, type RazorpayEnv } from "@/lib/env";
import { hmacSha256Hex, safeEqual } from "@/lib/security/tokens";

/**
 * Minimal, dependency-free Razorpay client (Orders, Payments, Refunds APIs).
 * Secrets are read from environment variables and never sent to the browser.
 */

export class RazorpayError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "RazorpayError";
  }
}

export type RazorpayOrder = {
  id: string;
  amount: number;
  amount_paid: number;
  currency: string;
  receipt: string | null;
  status: "created" | "attempted" | "paid";
  notes?: Record<string, string>;
};

export type RazorpayPayment = {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method: string | null;
  captured: boolean;
  email?: string;
  contact?: string;
  error_code?: string | null;
  error_description?: string | null;
  amount_refunded?: number;
  notes?: Record<string, string>;
};

export type RazorpayRefund = {
  id: string;
  payment_id: string;
  amount: number;
  status: "pending" | "processed" | "failed";
};

async function call<T>(env: RazorpayEnv, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const auth = Buffer.from(`${env.keyId}:${env.keySecret}`).toString("base64");
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const err = (json as { error?: { description?: string; code?: string } } | null)?.error;
    throw new RazorpayError(err?.description ?? `Razorpay request failed (${res.status})`, res.status, err?.code);
  }
  return json as T;
}

function requireEnv(): RazorpayEnv {
  const env = getRazorpayEnv();
  if (!env) throw new RazorpayError("Razorpay is not configured", 503, "NOT_CONFIGURED");
  return env;
}

export function isRazorpayConfigured(): boolean {
  return getRazorpayEnv() !== null;
}

export async function createRazorpayOrder(input: {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  return call<RazorpayOrder>(requireEnv(), "POST", "/orders", {
    amount: input.amountPaise,
    currency: "INR",
    receipt: input.receipt.slice(0, 40),
    notes: input.notes,
  });
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  return call<RazorpayPayment>(requireEnv(), "GET", `/payments/${encodeURIComponent(paymentId)}`);
}

export async function fetchRazorpayOrderPayments(orderId: string): Promise<RazorpayPayment[]> {
  const res = await call<{ items: RazorpayPayment[] }>(
    requireEnv(),
    "GET",
    `/orders/${encodeURIComponent(orderId)}/payments`,
  );
  return res.items ?? [];
}

export async function captureRazorpayPayment(paymentId: string, amountPaise: number): Promise<RazorpayPayment> {
  return call<RazorpayPayment>(requireEnv(), "POST", `/payments/${encodeURIComponent(paymentId)}/capture`, {
    amount: amountPaise,
    currency: "INR",
  });
}

export async function createRazorpayRefund(input: {
  paymentId: string;
  amountPaise: number;
  notes?: Record<string, string>;
}): Promise<RazorpayRefund> {
  return call<RazorpayRefund>(requireEnv(), "POST", `/payments/${encodeURIComponent(input.paymentId)}/refund`, {
    amount: input.amountPaise,
    speed: "normal",
    notes: input.notes ?? {},
  });
}

/** Signature returned to the browser by Razorpay Checkout after payment. */
export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const expected = hmacSha256Hex(input.keySecret, `${input.orderId}|${input.paymentId}`);
  return safeEqual(expected, input.signature);
}

/** X-Razorpay-Signature header on webhooks, computed over the RAW body. */
export function verifyWebhookSignature(input: { rawBody: string; signature: string; webhookSecret: string }): boolean {
  const expected = hmacSha256Hex(input.webhookSecret, input.rawBody);
  return safeEqual(expected, input.signature);
}

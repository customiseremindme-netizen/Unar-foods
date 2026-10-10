import "server-only";
import { getServiceDb } from "@/lib/db/client";
import { logError } from "@/lib/monitoring";

export type RateLimitRule = { limit: number; windowSeconds: number };

/** Shared limits, tuned for a small shop. */
export const RATE_LIMITS = {
  login: { limit: 8, windowSeconds: 600 },
  setup: { limit: 10, windowSeconds: 3600 },
  signup: { limit: 5, windowSeconds: 3600 },
  passwordReset: { limit: 5, windowSeconds: 3600 },
  verification: { limit: 3, windowSeconds: 600 },
  contact: { limit: 5, windowSeconds: 3600 },
  newsletter: { limit: 5, windowSeconds: 3600 },
  review: { limit: 5, windowSeconds: 3600 },
  reviewUpload: { limit: 6, windowSeconds: 3600 },
  checkout: { limit: 15, windowSeconds: 600 },
  paymentVerify: { limit: 30, windowSeconds: 600 },
  trackOrder: { limit: 15, windowSeconds: 600 },
  coupon: { limit: 20, windowSeconds: 600 },
  cart: { limit: 120, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

/**
 * Returns true when the request is allowed. Counters live in the database so
 * limits apply across all server instances. If the database is unreachable
 * we allow the request (the action itself will then fail safely).
 */
export async function checkRateLimit(bucket: keyof typeof RATE_LIMITS, identifier: string): Promise<boolean> {
  const rule = RATE_LIMITS[bucket];
  const db = getServiceDb();
  if (!db) return true;
  const { data, error } = await db.rpc("check_rate_limit", {
    p_key: `${bucket}:${identifier}`,
    p_limit: rule.limit,
    p_window_seconds: rule.windowSeconds,
  });
  if (error) {
    logError("rate-limit", error);
    return !["login", "signup", "setup", "passwordReset", "verification", "reviewUpload"].includes(bucket);
  }
  return data === true;
}

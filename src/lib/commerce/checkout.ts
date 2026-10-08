import "server-only";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getPublicSettings } from "@/lib/settings";
import { logError } from "@/lib/monitoring";
import { addressSchema, emailSchema, phoneSchema } from "@/lib/validation/common";
import { computeQuote } from "./pricing";
import { normalizeCouponCode } from "./coupons";
import type { CouponRow, PaymentMethod, Quote, QuoteLine, ShippingZone } from "./types";

export const checkoutSchema = z
  .object({
    email: emailSchema,
    phone: phoneSchema,
    shipping: addressSchema,
    billing_same: z.boolean(),
    billing: addressSchema.optional(),
    payment_method: z.enum(["razorpay", "cod"]),
    customer_note: z
      .string()
      .trim()
      .max(500, "Keep the note under 500 characters")
      .optional()
      .transform((v) => v || undefined),
    terms: z.literal(true, { error: "Please accept the terms and policies to continue" }),
    marketing_consent: z.boolean(),
    save_address: z.boolean(),
    recovery_consent: z.boolean().optional(),
    // Honeypot: real customers never fill this hidden field.
    website: z.string().max(0).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.billing_same && !value.billing) {
      ctx.addIssue({ code: "custom", path: ["billing", "line1"], message: "Enter your billing address" });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

const COUPON_COLUMNS =
  "id, code, discount_type, discount_value, min_subtotal_paise, max_discount_paise, usage_limit, per_customer_limit, starts_at, ends_at, is_active";

export async function loadCoupon(code: string | null | undefined): Promise<CouponRow | null> {
  if (!code) return null;
  const admin = getAdminSupabase();
  if (!admin) return null;
  const { data, error } = await admin.from("coupons").select(COUPON_COLUMNS).eq("code", normalizeCouponCode(code)).maybeSingle();
  if (error) logError("coupon.load", error);
  return data ?? null;
}

/** Usage-limit checks that need the database (dates/minimums are checked in pricing). */
export async function couponBlockReason(
  coupon: CouponRow,
  customer: { email?: string | null; userId?: string | null },
): Promise<string | null> {
  const admin = getAdminSupabase();
  if (!admin) return null;
  if (coupon.usage_limit !== null) {
    const { count } = await admin
      .from("coupon_usages")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", coupon.id)
      .in("status", ["reserved", "used"]);
    if ((count ?? 0) >= coupon.usage_limit) return "This coupon has reached its usage limit.";
  }
  if (coupon.per_customer_limit !== null && (customer.email || customer.userId)) {
    const used = new Set<string>();
    const filters: [string, string][] = [];
    if (customer.email) filters.push(["email", customer.email]);
    if (customer.userId) filters.push(["user_id", customer.userId]);
    for (const [column, value] of filters) {
      const { data } = await admin
        .from("coupon_usages")
        .select("id")
        .eq("coupon_id", coupon.id)
        .in("status", ["reserved", "used"])
        .eq(column, value);
      (data ?? []).forEach((row) => used.add(row.id));
    }
    if (used.size >= coupon.per_customer_limit) return "You have already used this coupon.";
  }
  return null;
}

export async function loadActiveZones(): Promise<ShippingZone[]> {
  const admin = getAdminSupabase();
  if (!admin) return [];
  const { data, error } = await admin
    .from("shipping_zones")
    .select(
      "id, name, is_active, sort_order, match_type, states, pincode_prefixes, rate_type, flat_rate_paise, base_weight_grams, base_rate_paise, additional_weight_step_grams, additional_rate_paise, free_shipping_threshold_paise, cod_available, delivery_estimate",
    )
    .eq("is_active", true);
  if (error) logError("shipping.zones", error);
  return data ?? [];
}

/** Builds a quote from LIVE database prices — never from browser-supplied totals. */
export async function quoteLines(input: {
  lines: QuoteLine[];
  couponCode: string | null;
  destination: { pincode?: string; state?: string } | null;
  paymentMethod: PaymentMethod;
  email?: string | null;
  userId?: string | null;
}): Promise<{ quote: Quote; coupon: CouponRow | null }> {
  const [settings, zones, coupon] = await Promise.all([
    getPublicSettings(),
    loadActiveZones(),
    loadCoupon(input.couponCode),
  ]);
  const blockReason = coupon ? await couponBlockReason(coupon, { email: input.email, userId: input.userId }) : null;
  const quote = computeQuote({
    lines: input.lines,
    coupon,
    couponBlockedReason: input.couponCode && !coupon ? "This coupon code is not valid." : blockReason,
    zones,
    checkout: settings.checkout,
    shipping: {
      enabled: settings.shipping.enabled,
      blocked_pincodes: settings.shipping.blocked_pincodes,
      packaging_weight_grams: settings.shipping.packaging_weight_grams,
    },
    tax: settings.tax,
    destination: input.destination,
    paymentMethod: input.paymentMethod,
    now: new Date(),
  });
  if (input.couponCode && !coupon) quote.couponError = "This coupon code is not valid.";
  return { quote, coupon };
}

/** Turns database exceptions from create_order into customer-friendly messages. */
export function describeOrderError(message: string): string {
  if (message.includes("INSUFFICIENT_STOCK")) return "Sorry, one of your items just went out of stock. Please review your cart.";
  if (message.includes("PRICE_CHANGED")) return "A price in your cart has just changed. Please review your order and try again.";
  if (message.includes("UNAVAILABLE")) return "One of your items is no longer available. Please review your cart.";
  if (message.includes("COUPON_LIMIT_REACHED")) return "This coupon has just reached its usage limit. Please remove it to continue.";
  if (message.includes("COUPON_CUSTOMER_LIMIT")) return "You have already used this coupon. Please remove it to continue.";
  if (message.includes("COUPON_INVALID")) return "This coupon can no longer be applied. Please remove it to continue.";
  if (message.includes("TOTAL_MISMATCH")) return "Your order total changed while checking out. Please try again.";
  if (message.includes("EMPTY_CART")) return "Your cart is empty.";
  return "We couldn't place your order. Please try again in a moment.";
}

/**
 * Releases stock held by unpaid orders whose payment window has expired.
 * Runs on a schedule and opportunistically before checkout, so abandoned
 * payments never block other customers for long.
 */
export async function releaseExpiredReservations(limit = 25): Promise<{ released: number; paid: number }> {
  const admin = getAdminSupabase();
  if (!admin) return { released: 0, paid: 0 };
  const { data: expired } = await admin
    .from("orders")
    .select("id, order_number")
    .eq("status", "pending_payment")
    .lt("reservation_expires_at", new Date().toISOString())
    .limit(limit);
  let released = 0;
  let paid = 0;
  for (const order of expired ?? []) {
    // Before releasing, make sure the payment didn't actually succeed.
    const { reconcileOrderPayment } = await import("./payments");
    const outcome = await reconcileOrderPayment(order.id);
    if (outcome === "paid") {
      paid++;
      continue;
    }
    if (outcome === "unknown") continue; // Razorpay unreachable — try again later.
    const { data } = await admin.rpc("release_order", {
      p_order_id: order.id,
      p_new_status: "expired",
      p_reason: "Payment not completed within the reservation window",
    });
    if (data) released++;
  }
  return { released, paid };
}

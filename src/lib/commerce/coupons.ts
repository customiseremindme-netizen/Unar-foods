import type { CouponRow } from "./types";

export type CouponResult =
  | { ok: true; discountPaise: number; freeShipping: boolean }
  | { ok: false; reason: string };

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Checks dates, status and minimum order, and computes the discount.
 * Usage limits are checked against the database separately (and again,
 * under a row lock, when the order is created).
 */
export function evaluateCoupon(coupon: CouponRow, input: { subtotalPaise: number; now: Date }): CouponResult {
  if (!coupon.is_active) return { ok: false, reason: "This coupon is not active." };
  if (coupon.starts_at && new Date(coupon.starts_at) > input.now) {
    return { ok: false, reason: "This coupon is not valid yet." };
  }
  if (coupon.ends_at && new Date(coupon.ends_at) <= input.now) {
    return { ok: false, reason: "This coupon has expired." };
  }
  if (input.subtotalPaise < coupon.min_subtotal_paise) {
    const rupees = (coupon.min_subtotal_paise / 100).toLocaleString("en-IN");
    return { ok: false, reason: `Add items worth at least ₹${rupees} to use this coupon.` };
  }

  switch (coupon.discount_type) {
    case "percent": {
      let discount = Math.floor((input.subtotalPaise * coupon.discount_value) / 100);
      if (coupon.max_discount_paise !== null) discount = Math.min(discount, coupon.max_discount_paise);
      return { ok: true, discountPaise: Math.min(discount, input.subtotalPaise), freeShipping: false };
    }
    case "fixed":
      return { ok: true, discountPaise: Math.min(coupon.discount_value, input.subtotalPaise), freeShipping: false };
    case "free_shipping":
      return { ok: true, discountPaise: 0, freeShipping: true };
    default:
      return { ok: false, reason: "This coupon cannot be applied." };
  }
}

import { evaluateCoupon } from "./coupons";
import { quoteShipping } from "./shipping";
import { calculateTax, type TaxSettings } from "./tax";
import type { CouponRow, PaymentMethod, Quote, QuoteLine, ShippingZone } from "./types";
import { formatINR } from "@/lib/money";

export type QuoteInput = {
  lines: QuoteLine[];
  coupon: CouponRow | null;
  /** Set when the coupon's usage limit is already reached (checked in the DB). */
  couponBlockedReason?: string | null;
  zones: ShippingZone[];
  checkout: {
    online_payments_enabled: boolean;
    cod_enabled: boolean;
    cod_fee_paise: number;
    cod_max_order_paise: number | null;
    min_order_paise: number;
    max_quantity_per_item: number;
  };
  shipping: { enabled: boolean; blocked_pincodes: string[]; packaging_weight_grams: number };
  tax: TaxSettings;
  destination: { pincode?: string; state?: string } | null;
  paymentMethod: PaymentMethod;
  now: Date;
};

/**
 * Computes the full price breakdown for a cart. This runs ONLY on the
 * server, using prices loaded from the database — totals sent by the browser
 * are never trusted.
 */
export function computeQuote(input: QuoteInput): Quote {
  const errors: string[] = [];

  const lines = input.lines.map((line) => ({ ...line, lineTotalPaise: line.unitPricePaise * line.quantity }));
  for (const line of lines) {
    if (!line.available) {
      errors.push(`${line.title} is no longer available. Please remove it from your cart.`);
    } else if (line.quantity > line.stock) {
      errors.push(
        line.stock <= 0
          ? `${line.title} is out of stock.`
          : `Only ${line.stock} of ${line.title} left in stock. Please reduce the quantity.`,
      );
    }
    if (line.quantity > input.checkout.max_quantity_per_item) {
      errors.push(`You can buy up to ${input.checkout.max_quantity_per_item} of ${line.title} per order.`);
    }
  }

  const subtotalPaise = lines.reduce((sum, l) => sum + l.lineTotalPaise, 0);
  const mrpTotalPaise = lines.reduce((sum, l) => sum + l.mrpPaise * l.quantity, 0);
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const weightGrams =
    lines.reduce((sum, l) => sum + l.weightGrams * l.quantity, 0) +
    (lines.length > 0 ? input.shipping.packaging_weight_grams : 0);

  // Coupon
  let discountPaise = 0;
  let freeShipping = false;
  let coupon: Quote["coupon"] = null;
  let couponError: string | null = null;
  if (input.coupon) {
    if (input.couponBlockedReason) {
      couponError = input.couponBlockedReason;
    } else {
      const result = evaluateCoupon(input.coupon, { subtotalPaise, now: input.now });
      if (result.ok) {
        discountPaise = result.discountPaise;
        freeShipping = result.freeShipping;
        coupon = { code: input.coupon.code, id: input.coupon.id, freeShipping };
      } else {
        couponError = result.reason;
      }
    }
  }

  const afterDiscount = subtotalPaise - discountPaise;

  if (lines.length > 0 && afterDiscount < input.checkout.min_order_paise) {
    errors.push(`The minimum order value is ${formatINR(input.checkout.min_order_paise)}.`);
  }

  // Shipping
  const shipping = quoteShipping({
    zones: input.zones,
    shippingEnabled: input.shipping.enabled,
    blockedPincodes: input.shipping.blocked_pincodes,
    destination: input.destination,
    weightGrams,
    subtotalAfterDiscountPaise: afterDiscount,
    freeShipping,
  });
  const shippingPaise = shipping.status === "ok" ? shipping.paise : 0;
  if (shipping.status === "unserviceable") errors.push(shipping.reason);
  if (shipping.status === "disabled") errors.push("Online ordering is paused at the moment. Please check back soon.");

  // Tax (on goods, after discount)
  const { taxPaise, breakdown } = calculateTax({
    lines: lines.map((l) => ({ lineTotalPaise: l.lineTotalPaise, gstRate: l.gstRate })),
    discountPaise,
    settings: input.tax,
    buyerState: input.destination?.state ?? null,
  });

  // Payment method
  const preCodTotal =
    afterDiscount + shippingPaise + (breakdown.configured && breakdown.mode === "exclusive" ? taxPaise : 0);
  const codAvailable =
    input.checkout.cod_enabled &&
    shipping.status === "ok" &&
    shipping.codAvailable &&
    (input.checkout.cod_max_order_paise === null || preCodTotal <= input.checkout.cod_max_order_paise);
  let codFeePaise = 0;
  if (input.paymentMethod === "cod") {
    if (!codAvailable && shipping.status !== "pending_address") {
      errors.push("Cash on Delivery is not available for this order.");
    } else if (codAvailable) {
      codFeePaise = input.checkout.cod_fee_paise;
    }
  } else if (!input.checkout.online_payments_enabled) {
    errors.push("Online payment is not available right now.");
  }

  const totalPaise = preCodTotal + codFeePaise;

  if (lines.length === 0) errors.push("Your cart is empty.");

  return {
    lines,
    itemCount,
    weightGrams,
    subtotalPaise,
    mrpTotalPaise,
    discountPaise,
    coupon,
    couponError,
    shipping,
    shippingPaise,
    codAvailable,
    codFeePaise,
    taxPaise,
    taxBreakdown: breakdown,
    totalPaise,
    errors: [...new Set(errors)],
    canCheckout: errors.length === 0 && shipping.status === "ok",
  };
}

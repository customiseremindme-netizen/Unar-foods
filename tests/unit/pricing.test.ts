import { describe, expect, it } from "vitest";
import { computeQuote, type QuoteInput } from "@/lib/commerce/pricing";
import { evaluateCoupon, normalizeCouponCode } from "@/lib/commerce/coupons";
import { calculateShippingPaise, findShippingZone } from "@/lib/commerce/shipping";
import { allocateDiscount, calculateTax } from "@/lib/commerce/tax";
import type { CouponRow, QuoteLine, ShippingZone } from "@/lib/commerce/types";

const zone = (overrides: Partial<ShippingZone> = {}): ShippingZone => ({
  id: "z-all",
  name: "All India",
  is_active: true,
  sort_order: 0,
  match_type: "all",
  states: [],
  pincode_prefixes: [],
  rate_type: "flat",
  flat_rate_paise: 6000,
  base_weight_grams: 500,
  base_rate_paise: 0,
  additional_weight_step_grams: 500,
  additional_rate_paise: 0,
  free_shipping_threshold_paise: 49900,
  cod_available: true,
  delivery_estimate: null,
  ...overrides,
});

const line = (overrides: Partial<QuoteLine> = {}): QuoteLine => ({
  variantId: "v1",
  productId: "p1",
  productSlug: "banana-chewy-dry-fruits-seeds",
  title: "Banana Chewy — Dry Fruits & Seeds",
  variantTitle: "100 g",
  sku: "UNAR-BC-NUTS-100",
  imageUrl: null,
  unitPricePaise: 14900,
  mrpPaise: 14900,
  quantity: 2,
  weightGrams: 100,
  gstRate: null,
  hsnCode: null,
  stock: 10,
  available: true,
  ...overrides,
});

const coupon = (overrides: Partial<CouponRow> = {}): CouponRow => ({
  id: "c1",
  code: "WELCOME10",
  discount_type: "percent",
  discount_value: 10,
  min_subtotal_paise: 0,
  max_discount_paise: null,
  usage_limit: null,
  per_customer_limit: null,
  starts_at: null,
  ends_at: null,
  is_active: true,
  ...overrides,
});

const baseInput = (overrides: Partial<QuoteInput> = {}): QuoteInput => ({
  lines: [line()],
  coupon: null,
  zones: [zone()],
  checkout: {
    online_payments_enabled: true,
    cod_enabled: true,
    cod_fee_paise: 2500,
    cod_max_order_paise: null,
    min_order_paise: 0,
    max_quantity_per_item: 10,
  },
  shipping: { enabled: true, blocked_pincodes: [], packaging_weight_grams: 0 },
  tax: { gst_registered: false, prices_include_tax: true, seller_state: "Tamil Nadu" },
  destination: { pincode: "641664", state: "Tamil Nadu" },
  paymentMethod: "razorpay",
  now: new Date("2026-10-08T10:00:00Z"),
  ...overrides,
});

describe("computeQuote", () => {
  it("adds flat shipping below the free-shipping threshold", () => {
    const q = computeQuote(baseInput());
    expect(q.subtotalPaise).toBe(29800);
    expect(q.shippingPaise).toBe(6000);
    expect(q.totalPaise).toBe(35800);
    expect(q.canCheckout).toBe(true);
  });

  it("gives free shipping at or above the threshold", () => {
    const q = computeQuote(baseInput({ lines: [line({ quantity: 4 })] }));
    expect(q.subtotalPaise).toBe(59600);
    expect(q.shippingPaise).toBe(0);
    expect(q.totalPaise).toBe(59600);
  });

  it("waits for an address before quoting shipping", () => {
    const q = computeQuote(baseInput({ destination: null }));
    expect(q.shipping.status).toBe("pending_address");
    expect(q.canCheckout).toBe(false);
    expect(q.totalPaise).toBe(29800);
  });

  it("blocks checkout when stock is insufficient", () => {
    const q = computeQuote(baseInput({ lines: [line({ quantity: 3, stock: 2 })] }));
    expect(q.canCheckout).toBe(false);
    expect(q.errors.join(" ")).toMatch(/Only 2/);
  });

  it("blocks out of stock and unavailable items", () => {
    expect(computeQuote(baseInput({ lines: [line({ stock: 0 })] })).errors.join(" ")).toMatch(/out of stock/);
    expect(computeQuote(baseInput({ lines: [line({ available: false })] })).canCheckout).toBe(false);
  });

  it("applies a percentage coupon before checking free shipping", () => {
    const q = computeQuote(baseInput({ lines: [line({ quantity: 4 })], coupon: coupon({ discount_value: 20 }) }));
    expect(q.discountPaise).toBe(11920);
    // 59600 - 11920 = 47680 < 49900 → shipping charged
    expect(q.shippingPaise).toBe(6000);
    expect(q.totalPaise).toBe(59600 - 11920 + 6000);
  });

  it("reports coupon problems without blocking checkout", () => {
    const q = computeQuote(baseInput({ coupon: coupon({ min_subtotal_paise: 100000 }) }));
    expect(q.discountPaise).toBe(0);
    expect(q.couponError).toMatch(/at least/);
    expect(q.canCheckout).toBe(true);
  });

  it("respects a usage-limit block from the database", () => {
    const q = computeQuote(baseInput({ coupon: coupon(), couponBlockedReason: "This coupon has reached its usage limit." }));
    expect(q.discountPaise).toBe(0);
    expect(q.couponError).toMatch(/usage limit/);
  });

  it("free-shipping coupons remove shipping", () => {
    const q = computeQuote(baseInput({ coupon: coupon({ discount_type: "free_shipping", discount_value: 0 }) }));
    expect(q.shippingPaise).toBe(0);
    expect(q.totalPaise).toBe(29800);
  });

  it("adds the COD fee only for COD orders where allowed", () => {
    const q = computeQuote(baseInput({ paymentMethod: "cod" }));
    expect(q.codAvailable).toBe(true);
    expect(q.codFeePaise).toBe(2500);
    expect(q.totalPaise).toBe(35800 + 2500);
  });

  it("refuses COD when disabled", () => {
    const q = computeQuote(
      baseInput({ paymentMethod: "cod", checkout: { ...baseInput().checkout, cod_enabled: false } }),
    );
    expect(q.codAvailable).toBe(false);
    expect(q.canCheckout).toBe(false);
  });

  it("refuses COD above the configured maximum", () => {
    const q = computeQuote(
      baseInput({ paymentMethod: "cod", checkout: { ...baseInput().checkout, cod_max_order_paise: 30000 } }),
    );
    expect(q.codAvailable).toBe(false);
  });

  it("enforces the minimum order value", () => {
    const q = computeQuote(baseInput({ checkout: { ...baseInput().checkout, min_order_paise: 50000 } }));
    expect(q.canCheckout).toBe(false);
  });

  it("enforces the per-item quantity limit", () => {
    const q = computeQuote(baseInput({ lines: [line({ quantity: 11, stock: 50 })] }));
    expect(q.canCheckout).toBe(false);
  });

  it("rejects blocked PIN codes and missing zones", () => {
    expect(
      computeQuote(baseInput({ shipping: { enabled: true, blocked_pincodes: ["641664"], packaging_weight_grams: 0 } }))
        .shipping.status,
    ).toBe("unserviceable");
    expect(computeQuote(baseInput({ zones: [] })).shipping.status).toBe("unserviceable");
  });

  it("does not add GST when the business is not GST registered", () => {
    const q = computeQuote(baseInput({ lines: [line({ gstRate: 12 })] }));
    expect(q.taxPaise).toBe(0);
    expect(q.taxBreakdown.configured).toBe(false);
  });

  it("adds exclusive GST to the total", () => {
    const q = computeQuote(
      baseInput({
        lines: [line({ gstRate: 5 })],
        tax: { gst_registered: true, prices_include_tax: false, seller_state: "Tamil Nadu" },
      }),
    );
    expect(q.taxPaise).toBe(1490);
    expect(q.totalPaise).toBe(29800 + 1490 + 6000);
  });
});

describe("tax", () => {
  it("extracts inclusive GST and splits CGST/SGST within the state", () => {
    const { taxPaise, breakdown } = calculateTax({
      lines: [{ lineTotalPaise: 10500, gstRate: 5 }],
      discountPaise: 0,
      settings: { gst_registered: true, prices_include_tax: true, seller_state: "Tamil Nadu" },
      buyerState: "tamil nadu",
    });
    expect(taxPaise).toBe(500);
    expect(breakdown.taxable_paise).toBe(10000);
    expect(breakdown.cgst_paise + breakdown.sgst_paise).toBe(500);
    expect(breakdown.igst_paise).toBe(0);
  });

  it("uses IGST for other states", () => {
    const { breakdown } = calculateTax({
      lines: [{ lineTotalPaise: 10500, gstRate: 5 }],
      discountPaise: 0,
      settings: { gst_registered: true, prices_include_tax: true, seller_state: "Tamil Nadu" },
      buyerState: "Kerala",
    });
    expect(breakdown.igst_paise).toBe(500);
  });

  it("never guesses a missing GST rate", () => {
    const { taxPaise, breakdown } = calculateTax({
      lines: [{ lineTotalPaise: 10000, gstRate: null }],
      discountPaise: 0,
      settings: { gst_registered: true, prices_include_tax: true, seller_state: "Tamil Nadu" },
      buyerState: "Kerala",
    });
    expect(taxPaise).toBe(0);
    expect(breakdown.configured).toBe(false);
  });

  it("allocates discounts proportionally and exactly", () => {
    const shares = allocateDiscount([14900, 12000, 100], 1001);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1001);
    expect(shares[0]).toBeGreaterThan(shares[1]);
  });
});

describe("coupons", () => {
  const now = new Date("2026-10-08T10:00:00Z");
  it("normalises codes", () => expect(normalizeCouponCode(" welcome 10 ")).toBe("WELCOME10"));
  it("caps percentage discounts", () => {
    const r = evaluateCoupon(coupon({ discount_value: 50, max_discount_paise: 5000 }), { subtotalPaise: 30000, now });
    expect(r).toEqual({ ok: true, discountPaise: 5000, freeShipping: false });
  });
  it("never discounts more than the subtotal", () => {
    const r = evaluateCoupon(coupon({ discount_type: "fixed", discount_value: 99900 }), { subtotalPaise: 14900, now });
    expect(r).toEqual({ ok: true, discountPaise: 14900, freeShipping: false });
  });
  it("respects start and end dates", () => {
    expect(evaluateCoupon(coupon({ starts_at: "2026-11-01T00:00:00Z" }), { subtotalPaise: 1, now }).ok).toBe(false);
    expect(evaluateCoupon(coupon({ ends_at: "2026-10-01T00:00:00Z" }), { subtotalPaise: 1, now }).ok).toBe(false);
    expect(evaluateCoupon(coupon({ is_active: false }), { subtotalPaise: 1, now }).ok).toBe(false);
  });
});

describe("shipping zones", () => {
  it("prefers PIN-prefix zones over state and all-India zones", () => {
    const zones = [
      zone({ id: "all" }),
      zone({ id: "tn", match_type: "states", states: ["Tamil Nadu"] }),
      zone({ id: "local", match_type: "pincode_prefixes", pincode_prefixes: ["6416"] }),
    ];
    expect(findShippingZone(zones, { pincode: "641664", state: "Tamil Nadu" })?.id).toBe("local");
    expect(findShippingZone(zones, { pincode: "600001", state: "Tamil Nadu" })?.id).toBe("tn");
    expect(findShippingZone(zones, { pincode: "110001", state: "Delhi" })?.id).toBe("all");
  });

  it("ignores inactive zones", () => {
    expect(findShippingZone([zone({ is_active: false })], { pincode: "110001" })).toBeNull();
  });

  it("calculates weight-based rates", () => {
    const z = zone({
      rate_type: "weight",
      base_weight_grams: 500,
      base_rate_paise: 5000,
      additional_weight_step_grams: 500,
      additional_rate_paise: 2000,
      free_shipping_threshold_paise: null,
    });
    expect(calculateShippingPaise(z, { weightGrams: 400, subtotalAfterDiscountPaise: 0, freeShipping: false }).paise).toBe(5000);
    expect(calculateShippingPaise(z, { weightGrams: 1200, subtotalAfterDiscountPaise: 0, freeShipping: false }).paise).toBe(9000);
  });
});

import type { Tables } from "@/lib/db/database.types";

export type ShippingZone = Pick<
  Tables<"shipping_zones">,
  | "id"
  | "name"
  | "is_active"
  | "sort_order"
  | "match_type"
  | "states"
  | "pincode_prefixes"
  | "rate_type"
  | "flat_rate_paise"
  | "base_weight_grams"
  | "base_rate_paise"
  | "additional_weight_step_grams"
  | "additional_rate_paise"
  | "free_shipping_threshold_paise"
  | "cod_available"
  | "delivery_estimate"
>;

export type CouponRow = Pick<
  Tables<"coupons">,
  | "id"
  | "code"
  | "discount_type"
  | "discount_value"
  | "min_subtotal_paise"
  | "max_discount_paise"
  | "usage_limit"
  | "per_customer_limit"
  | "starts_at"
  | "ends_at"
  | "is_active"
>;

export type QuoteLine = {
  variantId: string;
  productId: string;
  productSlug: string;
  title: string;
  variantTitle: string;
  sku: string;
  imageUrl: string | null;
  unitPricePaise: number;
  mrpPaise: number;
  quantity: number;
  weightGrams: number;
  gstRate: number | null;
  hsnCode: string | null;
  stock: number;
  available: boolean;
};

export type PaymentMethod = "razorpay" | "cod";

export type TaxBreakdown = {
  configured: boolean;
  mode: "inclusive" | "exclusive";
  intra_state: boolean;
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  rates: { rate: number; taxable_paise: number; tax_paise: number }[];
  note?: string;
};

export type ShippingQuote =
  | { status: "pending_address" }
  | { status: "disabled" }
  | { status: "unserviceable"; reason: string }
  | {
      status: "ok";
      zoneId: string;
      zoneName: string;
      paise: number;
      isFree: boolean;
      deliveryEstimate: string | null;
      codAvailable: boolean;
      freeShippingThresholdPaise: number | null;
    };

export type Quote = {
  lines: (QuoteLine & { lineTotalPaise: number })[];
  itemCount: number;
  weightGrams: number;
  subtotalPaise: number;
  mrpTotalPaise: number;
  discountPaise: number;
  coupon: { code: string; id: string; freeShipping: boolean } | null;
  couponError: string | null;
  shipping: ShippingQuote;
  shippingPaise: number;
  codAvailable: boolean;
  codFeePaise: number;
  taxPaise: number;
  taxBreakdown: TaxBreakdown;
  totalPaise: number;
  /** Problems that block checkout (shown to the customer). */
  errors: string[];
  canCheckout: boolean;
};

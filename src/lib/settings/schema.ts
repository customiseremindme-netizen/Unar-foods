import { z } from "zod";
import { emailSchema, linkSchema } from "@/lib/validation/common";

/**
 * Typed shapes for every row in the `settings` table, with safe defaults.
 * Unknown/invalid stored values fall back to these defaults, so a bad edit
 * can never crash the storefront.
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #2E4E36");
const navLink = z.object({ label: z.string().trim().min(1).max(40), href: linkSchema });

export const settingsSchemas = {
  store: z.object({
    name: z.string().trim().min(1).max(80).default("UNAR"),
    legal_name: z.string().trim().max(160).default(""),
    tagline: z.string().trim().max(120).default("One Healthy Habit a Day"),
    email: z.union([emailSchema, z.literal("")]).default("unarfoods@gmail.com"),
    phone: z.string().trim().max(20).default("9994657693"),
    whatsapp: z.string().trim().max(20).default("9994657693"),
    address_lines: z.array(z.string().trim().max(160)).max(6).default([]),
    city: z.string().trim().max(80).default(""),
    state: z.string().trim().max(80).default("Tamil Nadu"),
    pincode: z.string().trim().max(10).default(""),
    country: z.string().trim().max(60).default("India"),
    fssai_license: z.string().trim().max(40).default(""),
    business_hours: z.string().trim().max(160).default(""),
    details_confirmed: z.boolean().default(false),
  }),
  brand: z.object({
    logo_url: z.string().trim().max(500).default("/brand/unar-logo-transparent.webp"),
    logo_width: z.number().int().positive().default(960),
    logo_height: z.number().int().positive().default(307),
    logo_alt: z.string().trim().max(160).default("UNAR — One Healthy Habit a Day"),
    logo_svg_url: z.string().trim().max(500).default(""),
    favicon_url: z.string().trim().max(500).default(""),
  }),
  theme: z.object({
    forest: hex.default("#2E4E36"),
    olive: hex.default("#7A8F3D"),
    cream: hex.default("#F2F1E6"),
    sage: hex.default("#A8B99A"),
    accent: hex.default("#E2B33C"),
  }),
  appearance: z.object({
    heading_font: z.enum(["fraunces", "montserrat", "georgia"]).default("fraunces"),
    body_font: z.enum(["montserrat", "system"]).default("montserrat"),
    content_width: z.enum(["compact", "standard", "wide"]).default("standard"),
    button_style: z.enum(["pill", "soft", "square"]).default("pill"),
    image_style: z.enum(["organic", "soft", "square"]).default("organic"),
    sticky_header: z.boolean().default(true),
    animations_enabled: z.boolean().default(true),
    shop_columns: z.number().int().min(2).max(4).default(3),
    shop_heading: z.string().trim().min(1).max(120).default("Shop the Goodness"),
    shop_description: z.string().trim().max(400).default(""),
  }),
  seo: z.object({
    site_title: z.string().trim().max(120).default("UNAR — One Healthy Habit a Day"),
    title_template: z.string().trim().max(60).default("%s · UNAR"),
    description: z.string().trim().max(300).default(""),
    og_image_url: z.string().trim().max(500).default("/images/products/nuts-front.webp"),
    allow_indexing: z.boolean().default(true),
  }),
  social: z.object({
    instagram_url: z.union([z.literal(""), z.url().max(300)]).default(""),
    facebook_url: z.union([z.literal(""), z.url().max(300)]).default(""),
    youtube_url: z.union([z.literal(""), z.url().max(300)]).default(""),
    whatsapp_number: z.string().trim().max(20).default(""),
  }),
  navigation: z.object({
    header: z.array(navLink).max(8).default([]),
    footer_shop: z.array(navLink).max(10).default([]),
    footer_help: z.array(navLink).max(10).default([]),
  }),
  footer: z.object({
    blurb: z.string().trim().max(300).default(""),
    note: z.string().trim().max(300).default(""),
  }),
  checkout: z.object({
    online_payments_enabled: z.boolean().default(true),
    cod_enabled: z.boolean().default(false),
    cod_fee_paise: z.number().int().min(0).default(0),
    cod_max_order_paise: z.number().int().min(0).nullable().default(null),
    guest_checkout_enabled: z.boolean().default(true),
    reservation_minutes: z.number().int().min(10).max(120).default(30),
    min_order_paise: z.number().int().min(0).default(0),
    max_quantity_per_item: z.number().int().min(1).max(99).default(10),
  }),
  tax: z.object({
    gst_registered: z.boolean().default(false),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => v === "" || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), "Enter a valid 15-character GSTIN")
      .default(""),
    legal_name: z.string().trim().max(160).default(""),
    prices_include_tax: z.boolean().default(true),
    seller_state: z.string().trim().max(80).default("Tamil Nadu"),
    invoice_footer: z.string().trim().max(400).default(""),
  }),
  shipping: z.object({
    enabled: z.boolean().default(true),
    origin_pincode: z.string().trim().max(6).default(""),
    packaging_weight_grams: z.number().int().min(0).max(20000).default(0),
    blocked_pincodes: z.array(z.string().regex(/^\d{6}$/)).max(5000).default([]),
    checkout_note: z.string().trim().max(300).default(""),
  }),
  maintenance: z.object({
    enabled: z.boolean().default(false),
    message: z.string().trim().max(300).default("We're making a few improvements. Please check back soon."),
  }),
  reviews: z.object({
    enabled: z.boolean().default(true),
    require_verified_purchase: z.boolean().default(false),
  }),
  newsletter: z.object({
    enabled: z.boolean().default(true),
    consent_text: z
      .string()
      .trim()
      .max(300)
      .default("Yes, email me news and offers from UNAR. I can unsubscribe at any time."),
  }),
  product_defaults: z.object({
    shipping_returns_md: z.string().max(4000).default(""),
  }),
  notifications: z.object({
    from_name: z.string().trim().max(80).default("UNAR"),
    reply_to: z.union([emailSchema, z.literal("")]).default(""),
    admin_recipients: z.array(emailSchema).max(10).default([]),
    notify_admin_new_order: z.boolean().default(true),
    whatsapp_enabled: z.boolean().default(false),
    templates: z
      .record(
        z.string(),
        z.object({
          enabled: z.boolean().default(true),
          subject: z.string().trim().max(200),
          intro: z.string().trim().max(1000),
        }),
      )
      .default({}),
  }),
  shiprocket: z.object({
    enabled: z.boolean().default(false),
    pickup_location: z.string().trim().max(120).default(""),
    default_length_cm: z.number().min(1).max(200).default(20),
    default_breadth_cm: z.number().min(1).max(200).default(15),
    default_height_cm: z.number().min(1).max(200).default(5),
  }),
} as const;

export type SettingsKey = keyof typeof settingsSchemas;
export type SettingsValue<K extends SettingsKey> = z.output<(typeof settingsSchemas)[K]>;
export type AllSettings = { [K in SettingsKey]: SettingsValue<K> };

export const PUBLIC_SETTINGS: SettingsKey[] = [
  "store",
  "brand",
  "theme",
  "appearance",
  "seo",
  "social",
  "navigation",
  "footer",
  "checkout",
  "tax",
  "shipping",
  "maintenance",
  "reviews",
  "newsletter",
  "product_defaults",
];

/** Parses a stored value, merging over defaults and dropping invalid fields. */
export function parseSetting<K extends SettingsKey>(key: K, raw: unknown): SettingsValue<K> {
  const schema = settingsSchemas[key] as unknown as z.ZodType<SettingsValue<K>>;
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const full = schema.safeParse(input);
  if (full.success) return full.data;
  // Retry field-by-field: keep valid fields, fall back to defaults for the rest.
  const cleaned: Record<string, unknown> = { ...input };
  for (const issue of full.error.issues) {
    const top = issue.path[0];
    if (typeof top === "string") delete cleaned[top];
  }
  const retry = schema.safeParse(cleaned);
  return retry.success ? retry.data : (schema.parse({}) as SettingsValue<K>);
}

export function defaultSettings(): AllSettings {
  const out = {} as Record<string, unknown>;
  for (const key of Object.keys(settingsSchemas) as SettingsKey[]) {
    out[key] = parseSetting(key, {});
  }
  return out as AllSettings;
}

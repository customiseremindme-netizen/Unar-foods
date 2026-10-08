import { z } from "zod";
import { linkSchema } from "@/lib/validation/common";

/**
 * Homepage section registry.
 *
 * Each section type declares:
 *  - `fields`: how the admin form is drawn (no code needed to edit content)
 *  - `schema`: validation + safe defaults used when rendering
 *
 * To add a new section type: add an entry here and a matching component in
 * src/components/home/sections and register it in SectionRenderer.
 */

export const ICON_NAMES = [
  "leaf",
  "sprout",
  "sun",
  "scan-eye",
  "candy-off",
  "flask-off",
  "droplet-off",
  "wheat-off",
  "heart",
  "shield-check",
  "truck",
  "package",
  "recycle",
  "sparkles",
  "hand-heart",
  "banana",
  "nut",
  "award",
  "clock",
  "map-pin",
] as const;
export type IconName = (typeof ICON_NAMES)[number];

export type FieldDef =
  | { name: string; label: string; type: "text"; max?: number; help?: string; placeholder?: string }
  | { name: string; label: string; type: "textarea"; max?: number; help?: string; rows?: number }
  | { name: string; label: string; type: "markdown"; max?: number; help?: string }
  | { name: string; label: string; type: "image"; help?: string }
  | { name: string; label: string; type: "link"; help?: string }
  | { name: string; label: string; type: "icon"; help?: string }
  | { name: string; label: string; type: "number"; min: number; max: number; help?: string }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[]; help?: string }
  | { name: string; label: string; type: "products"; help?: string }
  | { name: string; label: string; type: "list"; itemLabel: string; max: number; fields: FieldDef[]; help?: string };

const text = (max: number) => z.string().trim().max(max).catch("");
const cta = z
  .object({ label: text(40).default(""), href: linkSchema.catch("") })
  .catch({ label: "", href: "" })
  .default({ label: "", href: "" });
const icon = z.enum(ICON_NAMES).catch("leaf");
const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || v.startsWith("/") || /^https:\/\//.test(v) || /^http:\/\/(127\.0\.0\.1|localhost)/.test(v))
  .catch("");

export const SECTION_TYPES = {
  hero: {
    label: "Hero banner",
    description: "The large welcome area at the top of the homepage.",
    fields: [
      { name: "eyebrow", label: "Small text above the headline", type: "text", max: 60 },
      { name: "headline", label: "Headline", type: "text", max: 120 },
      { name: "subheadline", label: "Supporting text", type: "textarea", max: 300 },
      { name: "primary_cta", label: "Main button", type: "link" },
      { name: "secondary_cta", label: "Second button", type: "link" },
      {
        name: "image_url",
        label: "Main image",
        type: "image",
        help: "Leave both images empty for a text-only hero with botanical artwork.",
      },
      { name: "image_alt", label: "Main image description (for screen readers & SEO)", type: "text", max: 160 },
      { name: "secondary_image_url", label: "Second image (optional)", type: "image" },
      { name: "secondary_image_alt", label: "Second image description", type: "text", max: 160 },
    ],
    schema: z.object({
      eyebrow: text(60).default(""),
      headline: text(120).default("Everyday snacking, naturally better."),
      subheadline: text(300).default(""),
      primary_cta: cta,
      secondary_cta: cta,
      image_url: imageUrl.default(""),
      image_alt: text(160).default(""),
      secondary_image_url: imageUrl.default(""),
      secondary_image_alt: text(160).default(""),
    }),
  },
  trust_strip: {
    label: "Trust strip",
    description: "A short row of approved product facts. Only add claims you have verified.",
    fields: [
      {
        name: "items",
        label: "Items",
        type: "list",
        itemLabel: "Item",
        max: 6,
        fields: [
          { name: "icon", label: "Icon", type: "icon" },
          { name: "label", label: "Text", type: "text", max: 40 },
        ],
      },
    ],
    schema: z.object({
      items: z.array(z.object({ icon, label: text(40) })).max(6).catch([]).default([]),
    }),
  },
  featured_products: {
    label: "Product showcase",
    description: "Shows your published products with prices and add-to-cart buttons.",
    fields: [
      { name: "eyebrow", label: "Small text above the heading", type: "text", max: 60 },
      { name: "heading", label: "Heading", type: "text", max: 120 },
      { name: "description", label: "Description", type: "textarea", max: 300 },
      {
        name: "product_slugs",
        label: "Products to show",
        type: "products",
        help: "Leave empty to show all featured products.",
      },
      { name: "cta_label", label: "Link text", type: "text", max: 40 },
      { name: "cta_href", label: "Link address", type: "text", max: 200 },
    ],
    schema: z.object({
      eyebrow: text(60).default(""),
      heading: text(120).default("Shop the Goodness"),
      description: text(300).default(""),
      product_slugs: z.array(z.string().max(120)).max(12).catch([]).default([]),
      cta_label: text(40).default(""),
      cta_href: linkSchema.catch("").default(""),
    }),
  },
  story_split: {
    label: "Story (image + text)",
    description: "An editorial split section with an image and your story.",
    fields: [
      { name: "eyebrow", label: "Small text above the heading", type: "text", max: 60 },
      { name: "heading", label: "Heading", type: "text", max: 120 },
      { name: "body_md", label: "Text", type: "markdown", max: 2000 },
      { name: "image_url", label: "Image", type: "image" },
      { name: "image_alt", label: "Image description", type: "text", max: 160 },
      { name: "cta", label: "Button", type: "link" },
    ],
    schema: z.object({
      eyebrow: text(60).default(""),
      heading: text(120).default(""),
      body_md: text(2000).default(""),
      image_url: imageUrl.default(""),
      image_alt: text(160).default(""),
      cta,
    }),
  },
  promise: {
    label: "Promise / values",
    description: "Your brand values. Avoid certifications or claims you can't verify.",
    fields: [
      { name: "eyebrow", label: "Small text above the heading", type: "text", max: 60 },
      { name: "heading", label: "Heading", type: "text", max: 120 },
      {
        name: "items",
        label: "Values",
        type: "list",
        itemLabel: "Value",
        max: 6,
        fields: [
          { name: "icon", label: "Icon", type: "icon" },
          { name: "title", label: "Title", type: "text", max: 60 },
          { name: "body", label: "Text", type: "textarea", max: 300 },
        ],
      },
    ],
    schema: z.object({
      eyebrow: text(60).default(""),
      heading: text(120).default(""),
      items: z
        .array(z.object({ icon, title: text(60), body: text(300) }))
        .max(6)
        .catch([])
        .default([]),
    }),
  },
  comparison: {
    label: "Product comparison",
    description: "Compares ingredients, allergen advice and nutrition of your published products automatically.",
    fields: [
      { name: "eyebrow", label: "Small text above the heading", type: "text", max: 60 },
      { name: "heading", label: "Heading", type: "text", max: 120 },
      { name: "description", label: "Description", type: "textarea", max: 300 },
    ],
    schema: z.object({
      eyebrow: text(60).default(""),
      heading: text(120).default(""),
      description: text(300).default(""),
    }),
  },
  how_its_made: {
    label: "How it's made",
    description: "Only describe steps you have confirmed. Hidden until you switch it on.",
    fields: [
      { name: "eyebrow", label: "Small text above the heading", type: "text", max: 60 },
      { name: "heading", label: "Heading", type: "text", max: 120 },
      { name: "description", label: "Description", type: "textarea", max: 400 },
      {
        name: "steps",
        label: "Steps",
        type: "list",
        itemLabel: "Step",
        max: 8,
        fields: [
          { name: "title", label: "Title", type: "text", max: 60 },
          { name: "body", label: "Text", type: "textarea", max: 300 },
        ],
      },
    ],
    schema: z.object({
      eyebrow: text(60).default(""),
      heading: text(120).default(""),
      description: text(400).default(""),
      steps: z
        .array(z.object({ title: text(60), body: text(300) }))
        .max(8)
        .catch([])
        .default([]),
    }),
  },
  reviews: {
    label: "Customer reviews",
    description: "Shows approved customer reviews. Shows a friendly message until reviews exist.",
    fields: [
      { name: "eyebrow", label: "Small text above the heading", type: "text", max: 60 },
      { name: "heading", label: "Heading", type: "text", max: 120 },
      { name: "description", label: "Description", type: "textarea", max: 300 },
      { name: "empty_text", label: "Message when there are no reviews", type: "textarea", max: 300 },
    ],
    schema: z.object({
      eyebrow: text(60).default(""),
      heading: text(120).default("What customers say"),
      description: text(300).default(""),
      empty_text: text(300).default("No reviews yet."),
    }),
  },
  faq: {
    label: "FAQ preview",
    description: "Shows FAQs marked 'show on homepage'. Edit questions in Content → FAQs.",
    fields: [
      { name: "eyebrow", label: "Small text above the heading", type: "text", max: 60 },
      { name: "heading", label: "Heading", type: "text", max: 120 },
      { name: "limit", label: "How many questions", type: "number", min: 1, max: 12 },
      { name: "cta_label", label: "Link text", type: "text", max: 40 },
      { name: "cta_href", label: "Link address", type: "text", max: 200 },
    ],
    schema: z.object({
      eyebrow: text(60).default(""),
      heading: text(120).default("Questions, answered"),
      limit: z.coerce.number().int().min(1).max(12).catch(5).default(5),
      cta_label: text(40).default(""),
      cta_href: linkSchema.catch("").default(""),
    }),
  },
  newsletter: {
    label: "Newsletter signup",
    description: "Email signup with consent. The consent wording is in Settings → Newsletter.",
    fields: [
      { name: "heading", label: "Heading", type: "text", max: 120 },
      { name: "description", label: "Description", type: "textarea", max: 300 },
    ],
    schema: z.object({
      heading: text(120).default("Join the UNAR circle"),
      description: text(300).default(""),
    }),
  },
  instagram: {
    label: "Instagram",
    description: "Shows the Instagram posts you add in Content → Instagram. Hidden when there are none.",
    fields: [
      { name: "heading", label: "Heading", type: "text", max: 120 },
      { name: "handle", label: "Instagram handle (without @)", type: "text", max: 60 },
      { name: "profile_url", label: "Profile link", type: "text", max: 200 },
    ],
    schema: z.object({
      heading: text(120).default("Follow along"),
      handle: text(60).default(""),
      profile_url: linkSchema.catch("").default(""),
    }),
  },
  contact_cta: {
    label: "Contact call-to-action",
    description: "A closing invitation to get in touch.",
    fields: [
      { name: "heading", label: "Heading", type: "text", max: 120 },
      { name: "body", label: "Text", type: "textarea", max: 300 },
      { name: "cta", label: "Button", type: "link" },
    ],
    schema: z.object({
      heading: text(120).default(""),
      body: text(300).default(""),
      cta,
    }),
  },
} satisfies Record<string, { label: string; description: string; fields: FieldDef[]; schema: z.ZodType }>;

export type SectionType = keyof typeof SECTION_TYPES;
export type SectionContent<T extends SectionType> = z.output<(typeof SECTION_TYPES)[T]["schema"]>;

export function isSectionType(type: string): type is SectionType {
  return type in SECTION_TYPES;
}

export function parseSectionContent<T extends SectionType>(type: T, raw: unknown): SectionContent<T> {
  const schema = SECTION_TYPES[type].schema as unknown as z.ZodType<SectionContent<T>>;
  const parsed = schema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  return schema.parse({});
}

export type HomeSection = {
  [T in SectionType]: { id: string; key: string; type: T; sortOrder: number; isVisible: boolean; content: SectionContent<T> };
}[SectionType];

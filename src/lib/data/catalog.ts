import "server-only";
import { cache } from "react";
import { getPublicSupabase } from "@/lib/supabase/public";
import { logError } from "@/lib/monitoring";

export type LabelItem = { label: string; approved: boolean };
export type NutritionRow = { nutrient: string; per_100g: string };

export type ProductImage = {
  id: string;
  url: string;
  alt: string;
  kind: string;
  width: number | null;
  height: number | null;
  sort_order: number;
};

export type ProductVariant = {
  id: string;
  title: string;
  sku: string;
  barcode: string | null;
  weight_grams: number;
  mrp_paise: number;
  price_paise: number;
  stock: number;
  low_stock_threshold: number;
  is_active: boolean;
  sort_order: number;
};

export type Product = {
  id: string;
  slug: string;
  title: string;
  short_title: string | null;
  subtitle: string | null;
  short_description: string | null;
  description_md: string;
  ingredients: string | null;
  allergens: string | null;
  dietary_mark: string | null;
  nutrition: NutritionRow[];
  nutrition_note: string | null;
  claims: string[];
  benefits: string[];
  storage_instructions: string | null;
  shelf_life: string | null;
  shipping_returns_md: string | null;
  manufacturer_info: string | null;
  fssai_license: string | null;
  is_featured: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  published_at: string | null;
  updated_at: string;
  images: ProductImage[];
  variants: ProductVariant[];
  defaultVariant: ProductVariant | null;
  categories: { slug: string; name: string }[];
};

const PRODUCT_SELECT = `
  id, slug, title, short_title, subtitle, short_description, description_md, ingredients, allergens,
  dietary_mark, nutrition, nutrition_note, claims, benefits, storage_instructions, shelf_life,
  shelf_life_approved, shipping_returns_md, manufacturer_info, fssai_license, is_featured, sort_order,
  seo_title, seo_description, og_image_url, published_at, updated_at,
  product_images ( id, url, alt, kind, width, height, sort_order ),
  product_variants ( id, title, sku, barcode, weight_grams, mrp_paise, price_paise, stock, low_stock_threshold, is_active, sort_order ),
  product_categories ( categories ( slug, name, is_active ) )
`;

function approvedLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is LabelItem => !!c && typeof c === "object" && typeof (c as LabelItem).label === "string")
    .filter((c) => c.approved === true && c.label.trim() !== "")
    .map((c) => c.label.trim());
}

function nutritionRows(raw: unknown): NutritionRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is NutritionRow => !!r && typeof r === "object" && typeof (r as NutritionRow).nutrient === "string")
    .map((r) => ({ nutrient: r.nutrient, per_100g: String(r.per_100g ?? "") }));
}

type Row = Record<string, unknown> & {
  product_images: ProductImage[] | null;
  product_variants: ProductVariant[] | null;
  product_categories: { categories: { slug: string; name: string; is_active: boolean } | null }[] | null;
};

function mapProduct(row: Row): Product {
  const images = [...(row.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const variants = [...(row.product_variants ?? [])]
    .filter((v) => v.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    short_title: (row.short_title as string | null) ?? null,
    subtitle: (row.subtitle as string | null) ?? null,
    short_description: (row.short_description as string | null) ?? null,
    description_md: (row.description_md as string) ?? "",
    ingredients: (row.ingredients as string | null) ?? null,
    allergens: (row.allergens as string | null) ?? null,
    dietary_mark: (row.dietary_mark as string | null) ?? null,
    nutrition: nutritionRows(row.nutrition),
    nutrition_note: (row.nutrition_note as string | null) ?? null,
    claims: approvedLabels(row.claims),
    benefits: approvedLabels(row.benefits),
    storage_instructions: (row.storage_instructions as string | null) ?? null,
    // Shelf life is a regulated statement: only shown once the owner approves it.
    shelf_life: row.shelf_life_approved ? ((row.shelf_life as string | null) ?? null) : null,
    shipping_returns_md: (row.shipping_returns_md as string | null) ?? null,
    manufacturer_info: (row.manufacturer_info as string | null) ?? null,
    fssai_license: (row.fssai_license as string | null) ?? null,
    is_featured: Boolean(row.is_featured),
    sort_order: Number(row.sort_order ?? 0),
    seo_title: (row.seo_title as string | null) ?? null,
    seo_description: (row.seo_description as string | null) ?? null,
    og_image_url: (row.og_image_url as string | null) ?? null,
    published_at: (row.published_at as string | null) ?? null,
    updated_at: row.updated_at as string,
    images,
    variants,
    defaultVariant: variants[0] ?? null,
    categories: (row.product_categories ?? [])
      .map((pc) => pc.categories)
      .filter((c): c is { slug: string; name: string; is_active: boolean } => !!c && c.is_active)
      .map((c) => ({ slug: c.slug, name: c.name })),
  };
}

/** All published products (row level security hides drafts). */
export const getPublishedProducts = cache(async (): Promise<Product[]> => {
  const supabase = getPublicSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    logError("catalog.list", error);
    return [];
  }
  return (data as unknown as Row[]).map(mapProduct);
});

export const getProductBySlug = cache(async (slug: string): Promise<Product | null> => {
  const products = await getPublishedProducts();
  return products.find((p) => p.slug === slug) ?? null;
});

export type Category = { id: string; slug: string; name: string; description: string | null };

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = getPublicSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, description")
    .eq("is_active", true)
    .order("sort_order");
  if (error) {
    logError("catalog.categories", error);
    return [];
  }
  return data ?? [];
});

export type Availability = "in_stock" | "low_stock" | "out_of_stock" | "unavailable";

export function variantAvailability(variant: ProductVariant | null): Availability {
  if (!variant) return "unavailable";
  if (variant.stock <= 0) return "out_of_stock";
  if (variant.stock <= variant.low_stock_threshold) return "low_stock";
  return "in_stock";
}

/** The first image in the gallery order (set by drag-and-drop in the dashboard). */
export function primaryImage(product: Product): ProductImage | null {
  return product.images[0] ?? null;
}

/** A label artwork image (front by default), used for close-up label views. */
export function labelImage(product: Product, side: "front_label" | "back_label" = "front_label"): ProductImage | null {
  return product.images.find((i) => i.kind === side) ?? null;
}

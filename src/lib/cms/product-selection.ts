/** The storefront and schema use the same published catalog; explicit owner selections stay respected. */
export function selectShowcaseProducts<T extends { slug: string; is_featured: boolean }>(products: T[], content: { product_slugs: string[]; product_selection?: "automatic" | "all" | "featured" | "selected"; max_products?: number }) {
  const mode = content.product_selection ?? "automatic";
  const selected = mode === "selected" || (mode === "automatic" && content.product_slugs.length > 0)
    ? content.product_slugs.map((slug) => products.find((p) => p.slug === slug)).filter((p): p is T => !!p)
    : mode === "featured" ? products.filter((p) => p.is_featured) : products;
  return [...new Map(selected.map((product) => [product.slug, product])).values()].slice(0, content.max_products ?? 12);
}

/** A new non-food product should not enter a nutrition table automatically. */
export function selectComparisonProducts<T extends { slug: string; ingredients: string | null; nutrition: unknown[] }>(products: T[], selectedSlugs: string[]) {
  const chosen = selectedSlugs.length
    ? selectedSlugs.map((slug) => products.find((product) => product.slug === slug)).filter((product): product is T => !!product)
    : products.filter((product) => !!product.ingredients?.trim() || product.nutrition.length > 0);
  return [...new Map(chosen.map((product) => [product.slug, product])).values()].slice(0, 3);
}

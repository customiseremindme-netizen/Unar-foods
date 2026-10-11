function stableValue(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
    }
    return item;
  });
}

/** Conservative gate for repairing the two original starter drafts. No database writes here. */
export function starterPublicationPlan(
  current: Record<string, unknown>,
  seed: Record<string, unknown>,
  variants: Record<string, unknown>[],
  images: Record<string, unknown>[],
  expectedUrls: string[],
): boolean {
  if (current.id !== seed.id || current.status !== "draft" || current.published_at != null) return false;
  if (Number(current.owner_edited) !== 0 || !current.created_at || current.created_at !== current.updated_at) return false;
  // Compare every supplied product field, so owner edits made outside the dashboard are preserved too.
  const excluded = new Set(["status", "published_at"]);
  for (const [key, expected] of Object.entries(seed)) {
    if (excluded.has(key)) continue;
    let actual = current[key];
    if (Array.isArray(expected) && typeof actual === "string") {
      try { actual = JSON.parse(actual); } catch { return false; }
    }
    if (typeof expected === "boolean") actual = actual === true || actual === 1 || actual === "1";
    if (stableValue(actual) !== stableValue(expected)) return false;
  }
  // Zero stock is deliberately allowed. Prices and all five gallery images must be valid.
  if (!variants.some((v) => (v.is_active === true || v.is_active === 1) && Number(v.price_paise) > 0 && Number(v.price_paise) <= Number(v.mrp_paise))) return false;
  return expectedUrls.length === 5 && expectedUrls.every((url) => images.some((i) => i.url === url && typeof i.alt === "string" && i.alt.trim()));
}

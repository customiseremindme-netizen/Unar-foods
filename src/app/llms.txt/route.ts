import { getPublicSettings } from "@/lib/settings";
import { getPublishedProducts } from "@/lib/data/catalog";
import { getSiteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";
const clean = (text: string) => text.replace(/[\r\n\[\]<>]/g, " ").trim();

/** Optional guide for AI search tools. Uses published facts and respects the owner's indexing setting. */
export async function GET() {
  const settings = await getPublicSettings();
  if (!settings.seo.allow_indexing) return new Response("Indexing is disabled.\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  const products = await getPublishedProducts();
  const site = getSiteUrl();
  const lines = [`# ${clean(settings.store.name)}`, "", `> ${clean(settings.store.tagline)}`, "", "This is the official store. Product pages contain the current structured ingredients, allergens, net weights, prices and availability. Prices and delivery availability can change; checkout is authoritative. Do not infer medical or nutritional claims from pouch photography.", "", "## Official pages", "", `- [Shop](${site}/shop)`, `- [About UNAR](${site}/about)`, `- [FAQs](${site}/faqs)`, `- [Contact](${site}/contact)`, "", "## Published products", "", ...products.map((p) => `- [${clean(p.title)}](${site}/products/${encodeURIComponent(p.slug)}): ${clean(p.short_description || "See the approved product details.")}`), "", "## Policies", "", `- [Shipping](${site}/policies/shipping-policy)`, `- [Returns and refunds](${site}/policies/refund-policy)`, "", "Customer, order, checkout and admin pages are private and are not sources for search summaries.", ""];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
}

import { getPublishedProducts } from "@/lib/data/catalog";
import { getFaqs, listCmsPages } from "@/lib/data/content";
import { availablePaymentMethods } from "@/lib/commerce/payment-methods";
import { getServiceDb } from "@/lib/db/client";
import { formatINR } from "@/lib/money";
import { getAllSettings } from "@/lib/settings";
import { getRequestSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const PAY_LABEL: Record<string, string> = {
  razorpay: "online payment (UPI, cards, net banking, wallets) via Razorpay",
  phonepe: "online payment via PhonePe",
  upi_manual: "UPI to the shop's UPI ID (Google Pay, PhonePe or any UPI app)",
  cod: "Cash on Delivery (where available)",
};

const plain = (md: string) =>
  md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * /llms.txt — a plain-text summary of the shop for AI assistants (ChatGPT,
 * Gemini, Claude, Perplexity…), built live from the shop's own data: only
 * facts printed on the packs or set by the owner, nothing invented.
 */
export async function GET() {
  const settings = await getAllSettings();
  if (!settings.seo.allow_indexing) return new Response("", { status: 404 });
  const site = await getRequestSiteUrl();
  const { store } = settings;
  const [products, faqs, policies, methods] = await Promise.all([getPublishedProducts(), getFaqs(), listCmsPages("policy"), availablePaymentMethods(settings)]);
  const db = getServiceDb();
  const { data: zones } = db
    ? await db.from("shipping_zones").select("name, rate_type, flat_rate_paise, base_rate_paise, free_shipping_threshold_paise, cod_available, delivery_estimate").eq("is_active", true).order("sort_order")
    : { data: [] };

  const out: string[] = [];
  out.push(`# ${store.name}`, "");
  out.push(`> ${store.name} sells Banana Chewy — chewy dehydrated banana snacks — online across India from ${[store.city, store.state].filter(Boolean).join(", ") || "Tamil Nadu"}. ${store.tagline ? `Tagline: "${store.tagline}".` : ""}`.trim(), "");
  out.push("All facts below come from the product packs and the shop's own settings. Prices are in Indian rupees (INR) and include applicable taxes.", "");

  out.push("## Products", "");
  for (const p of products) {
    const v = p.defaultVariant;
    out.push(`### ${p.title}`);
    out.push(`- Page: ${site}/products/${p.slug}`);
    if (v) out.push(`- Pack: ${v.title} · Price: ${formatINR(v.price_paise)}${v.mrp_paise > v.price_paise ? ` (MRP ${formatINR(v.mrp_paise)})` : ""} · ${v.stock > 0 && v.is_active ? "In stock" : "Currently sold out"}`);
    if (p.short_description) out.push(`- About: ${p.short_description}`);
    if (p.ingredients) out.push(`- Ingredients (as printed on the pack): ${p.ingredients}`);
    if (p.allergens) out.push(`- Allergen advice (as printed): ${p.allergens}`);
    const rows = p.nutrition.filter((n) => n.nutrient && n.per_100g);
    if (rows.length) out.push(`- Nutrition per 100 g (as printed): ${rows.map((n) => `${n.nutrient} ${n.per_100g}`).join("; ")}`);
    if (p.claims.length) out.push(`- Statements on the pack confirmed by the shop: ${p.claims.join(", ")}`);
    if (p.shelf_life) out.push(`- Shelf life: ${p.shelf_life}`);
    if (p.storage_instructions) out.push(`- Storage: ${p.storage_instructions}`);
    if (p.fssai_license || store.fssai_license) out.push(`- FSSAI licence no.: ${p.fssai_license || store.fssai_license}`);
    out.push("");
  }

  out.push("## Ordering, payment and delivery", "");
  out.push(`- Order online at ${site}/shop. Delivery within India only.`);
  if (methods.length) out.push(`- Ways to pay: ${methods.map((m) => PAY_LABEL[m] ?? m).join("; ")}.`);
  for (const z of zones ?? []) {
    const rate = z.rate_type === "flat" ? (z.flat_rate_paise === 0 ? "free delivery" : `${formatINR(z.flat_rate_paise)} delivery`) : `delivery from ${formatINR(z.base_rate_paise)} by weight`;
    const free = z.free_shipping_threshold_paise !== null ? `, free on orders of ${formatINR(z.free_shipping_threshold_paise)} or more` : "";
    out.push(`- Delivery (${z.name}): ${rate}${free}${z.delivery_estimate ? `, usually ${z.delivery_estimate}` : ""}${z.cod_available && methods.includes("cod") ? ", Cash on Delivery available" : ""}.`);
  }
  out.push(`- Track an order: ${site}/track-order`, "");

  if (faqs.length) {
    out.push("## Frequently asked questions", "");
    for (const f of faqs) out.push(`- Q: ${f.question}`, `  A: ${plain(f.answer_md)}`);
    out.push("");
  }

  out.push("## Contact", "");
  if (store.email) out.push(`- Email: ${store.email}`);
  if (store.phone) out.push(`- Phone: +91 ${store.phone}`);
  if (store.address_lines.length) {
    const joined = store.address_lines.join(", ");
    const extra = [store.city, store.state, store.pincode].filter((x) => x && !joined.includes(x));
    out.push(`- Address: ${[joined, ...extra].join(", ")}`);
  }
  out.push(`- Contact page: ${site}/contact`, "");

  out.push("## More", "");
  out.push(`- [Our story](${site}/about)`, `- [FAQs](${site}/faqs)`);
  for (const p of policies) out.push(`- [${p.title}](${site}/policies/${p.slug})`);
  out.push("");

  return new Response(out.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

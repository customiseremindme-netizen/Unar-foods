import type { PublicSettings } from "@/lib/settings";
import type { Product } from "@/lib/data/catalog";
import type { ReviewStats, PublicReview } from "@/lib/data/reviews";

/** Renders structured data safely (prevents breaking out of the script tag). */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

function absolute(site: string, url: string | null | undefined) {
  if (!url) return undefined;
  return url.startsWith("http") ? url : `${site}${url}`;
}

export function organizationJsonLd(settings: PublicSettings, site: string) {
  const sameAs = [settings.social.instagram_url, settings.social.facebook_url, settings.social.youtube_url].filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": `${site}/#organization`,
    name: settings.store.name,
    ...(settings.store.legal_name ? { legalName: settings.store.legal_name } : {}),
    description: settings.seo.description || undefined,
    url: site,
    areaServed: { "@type": "Country", name: "India" },
    currenciesAccepted: "INR",
    logo: absolute(site, settings.brand.logo_url),
    slogan: settings.store.tagline,
    ...(settings.store.email ? { email: settings.store.email } : {}),
    ...(settings.store.phone ? { telephone: `+91${settings.store.phone}` } : {}),
    ...(settings.store.address_lines.length
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: settings.store.address_lines.slice(0, 2).join(", "),
            addressLocality: settings.store.city || undefined,
            addressRegion: settings.store.state || undefined,
            postalCode: settings.store.pincode || undefined,
            addressCountry: "IN",
          },
        }
      : {}),
    ...(settings.store.email || settings.store.phone
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer service",
            areaServed: "IN",
            availableLanguage: ["English", "Tamil"],
            ...(settings.store.email ? { email: settings.store.email } : {}),
            ...(settings.store.phone ? { telephone: `+91${settings.store.phone}` } : {}),
          },
        }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** About / Contact pages: say what the page is and who it belongs to. */
export function webPageJsonLd(input: { site: string; path: string; type: "AboutPage" | "ContactPage"; name: string; description?: string | null }) {
  return {
    "@context": "https://schema.org",
    "@type": input.type,
    name: input.name,
    url: `${input.site}${input.path}`,
    ...(input.description ? { description: input.description } : {}),
    inLanguage: "en-IN",
    about: { "@id": `${input.site}/#organization` },
    isPartOf: { "@type": "WebSite", url: input.site },
  };
}

export function websiteJsonLd(settings: PublicSettings, site: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.store.name,
    url: site,
    inLanguage: "en-IN",
    publisher: { "@id": `${site}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: `${site}/shop?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(site: string, items: { name: string; href: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${site}${item.href}`,
    })),
  };
}

/**
 * Product structured data. Availability and ratings come from REAL data only:
 * no aggregateRating is emitted unless approved reviews exist.
 */
export function productJsonLd(input: {
  product: Product;
  site: string;
  brand: string;
  stats: ReviewStats | null;
  reviews: PublicReview[];
}) {
  const { product, site } = input;
  const variant = product.defaultVariant;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.seo_description || product.short_description || undefined,
    sku: variant?.sku,
    ...(variant?.barcode && /^\d{8,14}$/.test(variant.barcode) ? { gtin: variant.barcode } : {}),
    brand: { "@type": "Brand", name: input.brand },
    category: "Food > Snacks > Dried fruit snacks",
    image: product.images.filter((i) => !i.kind.endsWith("_label")).map((i) => absolute(site, i.url)),
    url: `${site}/products/${product.slug}`,
    ...(variant?.title ? { size: variant.title } : {}),
    // Facts as printed on the pack, so search engines and AI assistants can quote them exactly.
    additionalProperty: [
      product.ingredients ? { "@type": "PropertyValue", name: "Ingredients", value: product.ingredients } : null,
      product.allergens ? { "@type": "PropertyValue", name: "Allergen advice", value: product.allergens } : null,
      ...product.nutrition
        .filter((n) => n.nutrient && n.per_100g)
        .map((n) => ({ "@type": "PropertyValue", name: `${n.nutrient} (per 100 g)`, value: n.per_100g })),
    ].filter(Boolean),
    ...(variant
      ? {
          offers: {
            "@type": "Offer",
            url: `${site}/products/${product.slug}`,
            priceCurrency: "INR",
            price: (variant.price_paise / 100).toFixed(2),
            availability: variant.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
            seller: { "@type": "Organization", name: input.brand },
            eligibleRegion: { "@type": "Country", name: "IN" },
          },
        }
      : {}),
    ...(input.stats
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: input.stats.average,
            reviewCount: input.stats.count,
          },
          review: input.reviews.slice(0, 5).map((r) => ({
            "@type": "Review",
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
            author: { "@type": "Person", name: r.author_name },
            datePublished: r.created_at.slice(0, 10),
            reviewBody: r.body,
          })),
        }
      : {}),
  };
}

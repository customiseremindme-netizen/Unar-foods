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
    "@type": "Organization",
    name: settings.store.name,
    url: site,
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
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteJsonLd(settings: PublicSettings, site: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.store.name,
    url: site,
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
    ...(variant?.barcode && /^\d{8,14}$/.test(variant.barcode) ? { gtin13: variant.barcode } : {}),
    brand: { "@type": "Brand", name: input.brand },
    image: product.images.map((i) => absolute(site, i.url)),
    url: `${site}/products/${product.slug}`,
    ...(variant
      ? {
          offers: {
            "@type": "Offer",
            url: `${site}/products/${product.slug}`,
            priceCurrency: "INR",
            price: (variant.price_paise / 100).toFixed(2),
            availability: variant.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
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

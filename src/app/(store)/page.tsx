import type { Metadata } from "next";
import { getHomeSections, getFaqs, getInstagramPosts } from "@/lib/data/content";
import { getPublishedProducts } from "@/lib/data/catalog";
import { getApprovedReviews, reviewStats } from "@/lib/data/reviews";
import { getPublicSettings } from "@/lib/settings";
import { getSiteUrl } from "@/lib/env";
import type { HomeSection } from "@/lib/cms/sections";
import { Hero } from "@/components/home/hero";
import {
  Comparison,
  ContactCta,
  FaqSection,
  FeaturedProducts,
  HowItsMade,
  InstagramSection,
  NewsletterSection,
  PromiseSection,
  ReviewsSection,
  StorySplit,
  TrustStrip,
} from "@/components/home/sections";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getPublicSettings();
  return {
    title: { absolute: seo.site_title },
    description: seo.description,
    alternates: { canonical: "/" },
  };
}

export default async function HomePage() {
  const [sections, products, reviews, faqs, instagram, settings] = await Promise.all([
    getHomeSections(),
    getPublishedProducts(),
    getApprovedReviews(),
    getFaqs(),
    getInstagramPosts(),
    getPublicSettings(),
  ]);

  const stats = Object.fromEntries(
    products.map((p) => [p.id, reviewStats(reviews.filter((r) => r.product_id === p.id))]),
  );
  const productNames = Object.fromEntries(products.map((p) => [p.id, p.short_title ?? p.title]));
  const packTitles = [...new Set(products.flatMap((p) => p.variants.map((v) => v.title)))];
  const packLabel = packTitles.length === 1 ? `${packTitles[0]} packs` : packTitles.length > 1 ? "Multiple pack sizes" : null;

  function render(section: HomeSection) {
    switch (section.type) {
      case "hero":
        return <Hero content={section.content} productCount={products.length} packLabel={packLabel} />;
      case "trust_strip":
        return <TrustStrip content={section.content} />;
      case "featured_products":
        return <FeaturedProducts content={section.content} products={products} stats={stats} />;
      case "story_split":
        return <StorySplit content={section.content} />;
      case "promise":
        return <PromiseSection content={section.content} />;
      case "comparison":
        return <Comparison content={section.content} products={products} />;
      case "how_its_made":
        return <HowItsMade content={section.content} />;
      case "reviews":
        return <ReviewsSection content={section.content} reviews={reviews} productNames={productNames} />;
      case "faq":
        return <FaqSection content={section.content} faqs={faqs} />;
      case "newsletter":
        return settings.newsletter.enabled ? (
          <NewsletterSection content={section.content} consentText={settings.newsletter.consent_text} />
        ) : null;
      case "instagram":
        return <InstagramSection content={section.content} posts={instagram} />;
      case "contact_cta":
        return <ContactCta content={section.content} />;
      default:
        return null;
    }
  }

  const site = getSiteUrl();
  return (
    <>
      <JsonLd data={organizationJsonLd(settings, site)} />
      <JsonLd data={websiteJsonLd(settings, site)} />
      {sections.length === 0 ? (
        <section className="container-site py-32 text-center">
          <h1 className="text-[2.6rem]">{settings.store.name}</h1>
          <p className="mt-3 text-muted">{settings.store.tagline}</p>
        </section>
      ) : (
        sections.map((section) => <div key={section.id}>{render(section)}</div>)
      )}
    </>
  );
}

import Image from "next/image";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ChevronDown } from "lucide-react";
import type { SectionContent } from "@/lib/cms/sections";
import type { Product } from "@/lib/data/catalog";
import type { Faq, InstagramPost } from "@/lib/data/content";
import type { PublicReview, ReviewStats } from "@/lib/data/reviews";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, SectionHeading, Stars } from "@/components/ui/misc";
import { Markdown } from "@/components/ui/markdown";
import { CmsIcon } from "@/components/brand/icons";
import { BananaLeaf, LeafDivider, LeafSprig } from "@/components/brand/botanical";
import { Parallax, Reveal, Stagger, StaggerItem } from "@/components/motion/motion";
import { ProductCard } from "@/components/product/product-card";
import { NewsletterForm } from "./newsletter-form";

export function TrustStrip({ content }: { content: SectionContent<"trust_strip"> }) {
  const items = content.items.filter((i) => i.label.trim());
  if (items.length === 0) return null;
  return (
    <section aria-label="Product highlights" className="border-y border-line bg-paper/70">
      <div className="container-site">
        <Stagger className="flex snap-x gap-8 overflow-x-auto py-6 [scrollbar-width:none] sm:justify-center sm:gap-12 lg:gap-16">
          {items.map((item) => (
            <StaggerItem key={item.label} className="flex shrink-0 snap-start items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-sage-soft text-forest">
                <CmsIcon name={item.icon} className="size-[1.1rem]" />
              </span>
              <span className="text-[0.85rem] font-semibold tracking-[0.02em] text-forest">{item.label}</span>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

export function FeaturedProducts({
  content,
  products,
  stats,
}: {
  content: SectionContent<"featured_products">;
  products: Product[];
  stats: Record<string, ReviewStats | null>;
}) {
  const chosen =
    content.product_slugs.length > 0
      ? content.product_slugs.map((slug) => products.find((p) => p.slug === slug)).filter((p): p is Product => !!p)
      : products.filter((p) => p.is_featured).length > 0
        ? products.filter((p) => p.is_featured)
        : products;

  return (
    <section id="shop" aria-labelledby="shop-heading" className="relative py-24 lg:py-32">
      <div className="container-site">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <SectionHeading id="shop-heading" eyebrow={content.eyebrow} title={content.heading} description={content.description} />
          </Reveal>
          {content.cta_label && content.cta_href ? (
            <Reveal delay={0.1}>
              <Link href={content.cta_href} className="link-underline inline-flex items-center gap-2 text-[0.9rem] font-semibold text-forest">
                {content.cta_label} <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Reveal>
          ) : null}
        </div>
        {chosen.length === 0 ? (
          <EmptyState
            className="mt-14"
            title="Our products are being prepared"
            description="Banana Chewy will be available to order here soon."
          />
        ) : (
          <Stagger className="mt-14 grid gap-x-10 gap-y-16 sm:grid-cols-2 lg:gap-x-16" gap={0.14}>
            {chosen.map((product, i) => (
              <StaggerItem key={product.id}>
                <ProductCard product={product} stats={stats[product.id]} priority={i < 2} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </section>
  );
}

export function StorySplit({ content }: { content: SectionContent<"story_split"> }) {
  return (
    <section aria-labelledby="story-heading" className="paper relative overflow-hidden bg-paper py-24 lg:py-32">
      <LeafSprig className="absolute right-[6%] top-10 hidden h-44 w-28 text-sage lg:block" />
      <div className="container-site grid items-center gap-14 lg:grid-cols-12 lg:gap-20">
        <div className="relative lg:col-span-6">
          {content.image_url ? (
            <Parallax distance={30}>
              <Reveal y={30}>
                <div className="relative aspect-[4/5] overflow-hidden rounded-[2.5rem] shadow-lift sm:aspect-square">
                  <Image src={content.image_url} alt={content.image_alt} fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
                </div>
              </Reveal>
            </Parallax>
          ) : (
            <div className="grid aspect-square place-items-center rounded-[2.5rem] bg-sage-soft/60">
              <BananaLeaf className="h-4/5 text-forest/40" />
            </div>
          )}
          <div aria-hidden="true" className="absolute -bottom-6 -left-6 -z-10 size-40 rounded-[2rem] bg-sage-soft" />
        </div>
        <div className="lg:col-span-6">
          <Reveal>
            {content.eyebrow ? <p className="eyebrow mb-4">{content.eyebrow}</p> : null}
            <h2 id="story-heading" className="text-[2.1rem] sm:text-[2.8rem]">
              {content.heading}
            </h2>
            <LeafDivider className="my-7 h-5 w-44 text-sage" />
            {content.body_md ? <Markdown className="text-muted [&_p]:text-[1.05rem]">{content.body_md}</Markdown> : null}
            {content.cta.label && content.cta.href ? (
              <ButtonLink href={content.cta.href} variant="secondary" className="mt-9">
                {content.cta.label}
              </ButtonLink>
            ) : null}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function PromiseSection({ content }: { content: SectionContent<"promise"> }) {
  const items = content.items.filter((i) => i.title.trim());
  return (
    <section id="why-unar" aria-labelledby="promise-heading" className="relative overflow-hidden bg-forest py-24 text-cream lg:py-32">
      <BananaLeaf className="absolute -left-24 -top-10 h-[30rem] w-72 rotate-[-24deg] text-cream/[0.08]" />
      <BananaLeaf className="absolute -bottom-24 -right-16 h-[28rem] w-64 rotate-[160deg] text-cream/[0.08]" />
      <div className="container-site relative">
        <Reveal className="mx-auto max-w-2xl text-center">
          {content.eyebrow ? <p className="eyebrow mb-4 !text-banana-soft">{content.eyebrow}</p> : null}
          <h2 id="promise-heading" className="text-[2.2rem] !text-cream sm:text-[3rem]">
            {content.heading}
          </h2>
        </Reveal>
        <Stagger className="mt-16 grid gap-5 md:grid-cols-3 lg:gap-8" gap={0.12}>
          {items.map((item) => (
            <StaggerItem key={item.title}>
              <div className="h-full rounded-[2rem] bg-cream/[0.06] p-8 ring-1 ring-cream/10 transition-colors duration-500 hover:bg-cream/[0.1] lg:p-10">
                <span className="grid size-12 place-items-center rounded-full bg-cream/10 text-banana-soft">
                  <CmsIcon name={item.icon} className="size-5" />
                </span>
                <h3 className="mt-6 text-[1.45rem] !text-cream">{item.title}</h3>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-cream/80">{item.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function nutrientValue(product: Product, name: string) {
  return product.nutrition.find((n) => n.nutrient.toLowerCase() === name.toLowerCase())?.per_100g ?? "—";
}

export function Comparison({ content, products }: { content: SectionContent<"comparison">; products: Product[] }) {
  if (products.length < 2) return null;
  const shown = products.slice(0, 3);
  const nutrients = [...new Set(shown.flatMap((p) => p.nutrition.map((n) => n.nutrient)))];
  const rows: { label: string; render: (p: Product) => ReactNode }[] = [
    { label: "Ingredients (as printed)", render: (p) => p.ingredients ?? "—" },
    { label: "Allergen advice (as printed)", render: (p) => p.allergens ?? "No allergen statement printed on pack" },
    ...nutrients.map((n) => ({ label: `${n} (per 100 g)`, render: (p: Product) => nutrientValue(p, n) })),
    { label: "Pack", render: (p) => p.defaultVariant?.title ?? "—" },
    { label: "Price", render: (p) => (p.defaultVariant ? formatINR(p.defaultVariant.price_paise) : "—") },
  ];

  return (
    <section id="compare" aria-labelledby="compare-heading" className="py-24 lg:py-32">
      <div className="container-site">
        <Reveal>
          <SectionHeading id="compare-heading" align="center" eyebrow={content.eyebrow} title={content.heading} description={content.description} />
        </Reveal>

        {/* Desktop / tablet: side-by-side table */}
        <Reveal delay={0.1} className="mt-14 hidden overflow-hidden rounded-[2rem] border border-line bg-paper md:block">
          <table className="w-full text-left text-[0.92rem]">
            <caption className="sr-only">Comparison of {shown.map((p) => p.short_title ?? p.title).join(" and ")}</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="w-[24%] p-6 align-bottom text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-olive-ink">
                  Compare
                </th>
                {shown.map((p) => (
                  <th key={p.id} scope="col" className="p-6 align-bottom">
                    <Link href={`/products/${p.slug}`} className="group flex items-center gap-4">
                      {p.images[0] ? (
                        <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-cream-deep">
                          <Image src={p.images[0].url} alt="" fill sizes="64px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                        </span>
                      ) : null}
                      <span className="font-display text-[1.25rem] font-normal leading-tight text-forest group-hover:underline">
                        {p.short_title ?? p.title}
                      </span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? "bg-cream/50" : undefined}>
                  <th scope="row" className="p-5 pl-6 align-top text-[0.82rem] font-semibold text-graphite">
                    {row.label}
                  </th>
                  {shown.map((p) => (
                    <td key={p.id} className="p-5 align-top leading-relaxed text-muted">
                      {row.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>

        {/* Mobile: stacked cards */}
        <div className="mt-12 grid gap-6 md:hidden">
          {shown.map((p) => (
            <Reveal key={p.id} className="rounded-[1.75rem] border border-line bg-paper p-6">
              <Link href={`/products/${p.slug}`} className="font-display text-[1.35rem] text-forest underline-offset-4 hover:underline">
                {p.short_title ?? p.title}
              </Link>
              <dl className="mt-4 divide-y divide-line text-[0.88rem]">
                {rows.map((row) => (
                  <div key={row.label} className="grid grid-cols-[42%_1fr] gap-3 py-3">
                    <dt className="font-semibold text-graphite">{row.label}</dt>
                    <dd className="text-muted">{row.render(p)}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-center text-[0.78rem] text-muted">Nutrition values per 100 g, as printed on each pack.</p>
      </div>
    </section>
  );
}

export function HowItsMade({ content }: { content: SectionContent<"how_its_made"> }) {
  const steps = content.steps.filter((s) => s.title.trim());
  if (steps.length === 0) return null;
  return (
    <section aria-labelledby="made-heading" className="bg-paper py-24 lg:py-32">
      <div className="container-site">
        <Reveal>
          <SectionHeading id="made-heading" eyebrow={content.eyebrow} title={content.heading} description={content.description} />
        </Reveal>
        <Stagger className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <StaggerItem key={step.title} className="rounded-[1.75rem] border border-line bg-cream p-7">
              <span className="font-display text-[2.2rem] italic text-olive">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-4 text-[1.3rem]">{step.title}</h3>
              <p className="mt-2 text-[0.92rem] text-muted">{step.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

export function ReviewsSection({
  content,
  reviews,
  productNames,
}: {
  content: SectionContent<"reviews">;
  reviews: PublicReview[];
  productNames: Record<string, string>;
}) {
  const shown = reviews.slice(0, 6);
  return (
    <section aria-labelledby="reviews-heading" className="relative overflow-hidden py-24 lg:py-32">
      <div className="container-site">
        <Reveal>
          <SectionHeading id="reviews-heading" align="center" eyebrow={content.eyebrow} title={content.heading} description={content.description} />
        </Reveal>
        {shown.length === 0 ? (
          <Reveal className="mx-auto mt-12 max-w-xl">
            <EmptyState title="Be the first to review" description={content.empty_text} />
          </Reveal>
        ) : (
          <Stagger className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((review) => (
              <StaggerItem key={review.id}>
                <figure className="flex h-full flex-col rounded-[1.75rem] border border-line bg-paper p-7">
                  <Stars rating={review.rating} />
                  {review.title ? <p className="mt-4 font-display text-[1.2rem] text-forest">{review.title}</p> : null}
                  <blockquote className="mt-3 flex-1 text-[0.95rem] leading-relaxed text-graphite">
                    <p className="line-clamp-6">“{review.body}”</p>
                  </blockquote>
                  <figcaption className="mt-6 text-[0.8rem] text-muted">
                    <span className="font-semibold text-graphite">{review.author_name}</span>
                    {review.is_verified_purchase ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-success">
                        <BadgeCheck className="size-3.5" aria-hidden="true" /> Verified purchase
                      </span>
                    ) : null}
                    <span className="block">
                      {productNames[review.product_id] ?? ""} · {formatDate(review.created_at)}
                    </span>
                  </figcaption>
                </figure>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </section>
  );
}

export function FaqList({ faqs, headingLevel = 3 }: { faqs: Faq[]; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="divide-y divide-line border-y border-line">
      {faqs.map((faq) => (
        <details key={faq.id} className="group py-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden">
            <H className="font-sans text-[1.02rem] font-semibold tracking-normal text-forest">{faq.question}</H>
            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-forest transition-transform duration-300 group-open:rotate-180">
              <ChevronDown className="size-4" aria-hidden="true" />
            </span>
          </summary>
          <div className="pb-6 pr-12">
            <Markdown className="text-[0.95rem] text-muted">{faq.answer_md}</Markdown>
          </div>
        </details>
      ))}
    </div>
  );
}

export function FaqSection({ content, faqs }: { content: SectionContent<"faq">; faqs: Faq[] }) {
  const shown = faqs.filter((f) => f.show_on_home).slice(0, content.limit);
  if (shown.length === 0) return null;
  return (
    <section aria-labelledby="faq-heading" className="paper bg-paper py-24 lg:py-32">
      <div className="container-site grid gap-12 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <SectionHeading id="faq-heading" eyebrow={content.eyebrow} title={content.heading} />
          {content.cta_label && content.cta_href ? (
            <ButtonLink href={content.cta_href} variant="secondary" className="mt-8">
              {content.cta_label}
            </ButtonLink>
          ) : null}
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-8">
          <FaqList faqs={shown} />
        </Reveal>
      </div>
    </section>
  );
}

export function NewsletterSection({
  content,
  consentText,
}: {
  content: SectionContent<"newsletter">;
  consentText: string;
}) {
  return (
    <section aria-labelledby="newsletter-heading" className="py-24 lg:py-28">
      <div className="container-site">
        <Reveal className="relative overflow-hidden rounded-[2.5rem] bg-sage-soft px-6 py-14 sm:px-12 lg:px-20 lg:py-20">
          <LeafSprig className="absolute -right-4 -top-6 h-56 w-36 text-forest/20" />
          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 id="newsletter-heading" className="text-[2rem] sm:text-[2.6rem]">
                {content.heading}
              </h2>
              {content.description ? <p className="mt-4 max-w-md text-muted">{content.description}</p> : null}
            </div>
            <NewsletterForm consentText={consentText} source="home" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function InstagramSection({ content, posts }: { content: SectionContent<"instagram">; posts: InstagramPost[] }) {
  if (posts.length === 0) return null;
  return (
    <section aria-labelledby="instagram-heading" className="py-24">
      <div className="container-site">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Reveal>
            <h2 id="instagram-heading" className="text-[2rem] sm:text-[2.5rem]">
              {content.heading}
            </h2>
          </Reveal>
          {content.profile_url ? (
            <a href={content.profile_url} target="_blank" rel="noopener noreferrer" className="link-underline text-[0.9rem] font-semibold text-forest">
              {content.handle ? `@${content.handle}` : "Instagram"}
            </a>
          ) : null}
        </div>
        <Stagger className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {posts.map((post) => (
            <StaggerItem key={post.id}>
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block aspect-square overflow-hidden rounded-2xl bg-cream-deep"
              >
                <Image
                  src={post.image_url}
                  alt={post.image_alt || post.caption || "UNAR on Instagram"}
                  fill
                  sizes="(min-width: 640px) 25vw, 50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </a>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

export function ContactCta({ content }: { content: SectionContent<"contact_cta"> }) {
  if (!content.heading) return null;
  return (
    <section aria-labelledby="contact-cta-heading" className="pb-8 pt-12">
      <div className="container-site">
        <Reveal className="relative overflow-hidden rounded-[2.5rem] border border-line bg-paper px-6 py-16 text-center sm:px-12">
          <LeafSprig className="absolute left-1/2 top-4 h-24 w-16 -translate-x-1/2 text-sage" />
          <h2 id="contact-cta-heading" className="mx-auto mt-16 max-w-xl text-[2rem] sm:text-[2.5rem]">
            {content.heading}
          </h2>
          {content.body ? <p className="mx-auto mt-4 max-w-lg text-muted">{content.body}</p> : null}
          {content.cta.label && content.cta.href ? (
            <ButtonLink href={content.cta.href} className="mt-8">
              {content.cta.label}
            </ButtonLink>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Leaf, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { getPreviewProductBySlug, getProductBySlug, getPublishedProducts, primaryImage, variantAvailability } from "@/lib/data/catalog";
import { getProductReviews, reviewStats } from "@/lib/data/reviews";
import { getPublicSettings } from "@/lib/settings";
import { getSiteUrl } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { Badge, Breadcrumbs, Price, Stars, VegMark } from "@/components/ui/misc";
import { Markdown } from "@/components/ui/markdown";
import { ProductGallery } from "@/components/product/gallery";
import { BuyBox } from "@/components/product/add-to-cart";
import { ProductCard } from "@/components/product/product-card";
import { ReviewForm } from "@/components/product/review-form";
import { Reveal } from "@/components/motion/motion";
import { LeafSprig } from "@/components/brand/botanical";
import { JsonLd, breadcrumbJsonLd, productJsonLd } from "@/lib/seo/jsonld";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const published = await getProductBySlug(slug);
  const product = published ?? (await getPreviewProductBySlug(slug));
  if (!product) return { title: "Product not found", robots: { index: false } };
  if (!published) return { title: `Preview: ${product.title}`, robots: { index: false, follow: false } };
  const image = product.og_image_url ?? primaryImage(product)?.url;
  const title = product.seo_title || product.title;
  const description = product.seo_description || product.short_description || undefined;
  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { type: "website", title, description, images: image ? [{ url: image }] : undefined },
  };
}

function DetailBlock({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <details id={id} className="group border-b border-line py-1" open={id === "ingredients"}>
      <summary className="flex cursor-pointer list-none items-center justify-between py-5 [&::-webkit-details-marker]:hidden">
        <h2 className="font-sans text-[1rem] font-semibold tracking-normal text-forest">{title}</h2>
        <span aria-hidden="true" className="text-[1.4rem] leading-none text-olive transition-transform duration-300 group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="pb-6 text-[0.95rem] leading-relaxed text-graphite">{children}</div>
    </details>
  );
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = (await getProductBySlug(slug)) ?? (await getPreviewProductBySlug(slug));
  if (!product) notFound();

  const [settings, reviews, all] = await Promise.all([getPublicSettings(), getProductReviews(product.id), getPublishedProducts()]);
  const stats = reviewStats(reviews);
  const variant = product.defaultVariant;
  const availability = variantAvailability(variant);
  const soldOut = availability === "out_of_stock" || availability === "unavailable";
  const maxQuantity = variant ? Math.min(variant.stock, settings.checkout.max_quantity_per_item) : 0;
  const related = all.filter((p) => p.id !== product.id).slice(0, 3);
  const site = getSiteUrl();
  const name = product.short_title ?? product.title;
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Shop", href: "/shop" },
    { name, href: `/products/${product.slug}` },
  ];
  const shippingMd = product.shipping_returns_md || settings.product_defaults.shipping_returns_md;

  return (
    <>
      <JsonLd data={productJsonLd({ product, site, brand: settings.store.name, stats, reviews })} />
      <JsonLd data={breadcrumbJsonLd(site, crumbs)} />

      <div className="container-site pb-8 pt-8 lg:pt-10">
        <Breadcrumbs items={crumbs} />
      </div>

      <section className="container-site grid gap-12 lg:grid-cols-12 lg:gap-16" aria-labelledby="product-title">
        <div className="min-w-0 lg:col-span-7">
          <div className="lg:sticky lg:top-28">
            <ProductGallery
              productName={name}
              images={product.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, kind: i.kind, width: i.width, height: i.height }))}
            />
          </div>
        </div>

        <div className="min-w-0 lg:col-span-5">
          {product.subtitle ? <p className="eyebrow">{product.subtitle}</p> : null}
          <h1 id="product-title" className="mt-3 text-[2.2rem] leading-tight sm:text-[2.7rem]">
            {product.title}
          </h1>
          {stats ? (
            <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-[0.85rem] text-muted hover:text-forest">
              <Stars rating={stats.average} /> {stats.average} · {stats.count} review{stats.count === 1 ? "" : "s"}
            </a>
          ) : null}

          <div className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-2">
            {variant ? <Price pricePaise={variant.price_paise} mrpPaise={variant.mrp_paise} size="lg" /> : null}
            {availability === "in_stock" ? (
              <Badge tone="success">In stock</Badge>
            ) : availability === "low_stock" ? (
              <Badge tone="banana">Only {variant!.stock} left</Badge>
            ) : (
              <Badge tone="muted">Sold out</Badge>
            )}
          </div>
          {variant ? (
            <p className="mt-2 text-[0.8rem] text-muted">
              {variant.mrp_paise === variant.price_paise ? "MRP " : ""}
              {settings.tax.prices_include_tax ? "Inclusive of all taxes" : "GST added at checkout"} · Net weight {variant.title} · SKU{" "}
              {variant.sku}
            </p>
          ) : null}

          {product.short_description ? <p className="mt-6 text-[1.02rem] leading-relaxed text-muted">{product.short_description}</p> : null}

          {product.claims.length > 0 || product.dietary_mark === "vegetarian" ? (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Product highlights">
              {product.dietary_mark === "vegetarian" ? (
                <li className="inline-flex items-center rounded-full bg-paper px-3 py-1.5 ring-1 ring-line">
                  <VegMark />
                </li>
              ) : null}
              {product.claims.map((claim) => (
                <li key={claim} className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1.5 text-[0.8rem] font-medium text-forest">
                  <Leaf className="size-3.5" aria-hidden="true" /> {claim}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-8 rounded-[1.75rem] border border-line bg-paper p-5 sm:p-6">
            <BuyBox variantId={variant?.id ?? null} maxQuantity={maxQuantity} productName={name} soldOut={soldOut} />
            <ul className="mt-5 grid gap-2.5 border-t border-line pt-5 text-[0.82rem] text-muted">
              <li className="flex items-center gap-2.5">
                <ShieldCheck className="size-4 text-olive" aria-hidden="true" /> Secure checkout
              </li>
              <li className="flex items-center gap-2.5">
                <Truck className="size-4 text-olive" aria-hidden="true" /> Shipping calculated from your PIN code at checkout
              </li>
              <li className="flex items-center gap-2.5">
                <PackageCheck className="size-4 text-olive" aria-hidden="true" /> Track your order from your account or the Track Order page
              </li>
            </ul>
          </div>

          <div className="mt-8 border-t border-line">
            {product.description_md ? (
              <DetailBlock title="Description">
                <Markdown>{product.description_md}</Markdown>
              </DetailBlock>
            ) : null}
            <DetailBlock title="Ingredients & allergen advice" id="ingredients">
              <p>
                <span className="font-semibold text-forest">Ingredients: </span>
                {product.ingredients ?? "Not provided."}
              </p>
              <p className="mt-3">
                <span className="font-semibold text-forest">Allergen advice: </span>
                {product.allergens ?? "No allergen statement is printed on this pack. If you have a food allergy, please contact us before ordering."}
              </p>
              {product.benefits.length > 0 ? (
                <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
                  {product.benefits.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-muted">
                      <BadgeCheck className="size-4 text-olive" aria-hidden="true" /> {b}
                    </li>
                  ))}
                </ul>
              ) : null}
            </DetailBlock>
            {product.nutrition.length > 0 ? (
              <DetailBlock title="Nutritional information">
                <table className="w-full text-[0.92rem]">
                  <caption className="sr-only">Nutritional information per 100 g</caption>
                  <thead>
                    <tr className="border-b border-line text-left text-[0.78rem] uppercase tracking-[0.12em] text-olive-ink">
                      <th scope="col" className="py-2 font-semibold">
                        Nutrient
                      </th>
                      <th scope="col" className="py-2 text-right font-semibold">
                        Per 100 g
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.nutrition.map((row) => (
                      <tr key={row.nutrient} className="border-b border-line/70">
                        <th scope="row" className="py-2.5 text-left font-normal">
                          {row.nutrient}
                        </th>
                        <td className="py-2.5 text-right tabular-nums">{row.per_100g}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {product.nutrition_note ? <p className="mt-3 text-[0.82rem] text-muted">{product.nutrition_note}</p> : null}
                <p className="mt-1 text-[0.78rem] text-muted">Values as printed on the pack.</p>
              </DetailBlock>
            ) : null}
            {product.storage_instructions || product.shelf_life ? (
              <DetailBlock title="Storage & shelf life">
                {product.storage_instructions ? <p>{product.storage_instructions}</p> : null}
                {product.shelf_life ? <p className="mt-2">{product.shelf_life}</p> : null}
              </DetailBlock>
            ) : null}
            {shippingMd ? (
              <DetailBlock title="Shipping & returns">
                <Markdown>{shippingMd}</Markdown>
              </DetailBlock>
            ) : null}
            {product.manufacturer_info || product.fssai_license ? (
              <DetailBlock title="Manufacturer & licence">
                {product.manufacturer_info ? <p>{product.manufacturer_info}</p> : null}
                {product.fssai_license ? <p className="mt-2">FSSAI Lic. No. {product.fssai_license}</p> : null}
                {variant?.barcode ? <p className="mt-2 text-muted">Barcode: {variant.barcode}</p> : null}
              </DetailBlock>
            ) : null}
          </div>
        </div>
      </section>

      <section id="reviews" aria-labelledby="reviews-title" className="container-site mt-24 grid gap-12 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-5">
          <h2 id="reviews-title" className="text-[2rem]">
            Customer reviews
          </h2>
          {stats ? (
            <p className="mt-3 flex items-center gap-3 text-muted">
              <Stars rating={stats.average} /> {stats.average} out of 5 · {stats.count} review{stats.count === 1 ? "" : "s"}
            </p>
          ) : (
            <p className="mt-3 text-muted">No reviews yet. Tried it? We&apos;d love to hear what you think.</p>
          )}
          {settings.reviews.enabled ? (
            <div className="mt-8 rounded-[1.75rem] border border-line bg-paper p-6">
              <h3 className="mb-5 font-sans text-[1rem] font-semibold tracking-normal">Write a review</h3>
              <ReviewForm productId={product.id} productSlug={product.slug} />
            </div>
          ) : null}
        </div>
        <div className="min-w-0 lg:col-span-7">
          {reviews.length > 0 ? (
            <ul className="divide-y divide-line border-y border-line">
              {reviews.map((r) => (
                <li key={r.id} className="py-7">
                  <div className="flex flex-wrap items-center gap-3">
                    <Stars rating={r.rating} />
                    {r.title ? <p className="font-semibold text-forest">{r.title}</p> : null}
                  </div>
                  <p className="mt-3 whitespace-pre-line leading-relaxed">{r.body}</p>
                  <p className="mt-3 text-[0.8rem] text-muted">
                    {r.author_name} · {formatDate(r.created_at)}
                    {r.is_verified_purchase ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-success">
                        <BadgeCheck className="size-3.5" aria-hidden="true" /> Verified purchase
                      </span>
                    ) : null}
                  </p>
                  {r.admin_reply ? (
                    <div className="mt-4 rounded-2xl bg-sage-soft/60 p-4 text-[0.9rem]">
                      <p className="font-semibold text-forest">Reply from {settings.store.name}</p>
                      <p className="mt-1 whitespace-pre-line text-muted">{r.admin_reply}</p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="relative grid h-full min-h-56 place-items-center overflow-hidden rounded-[2rem] border border-dashed border-line bg-paper/60 p-10 text-center">
              <LeafSprig className="absolute -right-4 -top-4 h-40 w-28 text-sage" />
              <p className="relative max-w-sm text-muted">Reviews from verified buyers and signed-in customers will appear here after they are checked.</p>
            </div>
          )}
        </div>
      </section>

      {related.length > 0 ? (
        <section aria-labelledby="related-title" className="container-site mt-28">
          <Reveal>
            <h2 id="related-title" className="text-[2rem]">
              You may also like
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <p className="mt-10 text-center">
            <Link href="/shop" className="link-underline text-[0.9rem] font-semibold text-forest">
              View all products
            </Link>
          </p>
        </section>
      ) : null}
    </>
  );
}

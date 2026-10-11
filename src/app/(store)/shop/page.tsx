import type { Metadata } from "next";
import Link from "next/link";
import { getPublicSettings } from "@/lib/settings";
import { getCategories, getPublishedProducts, type Product } from "@/lib/data/catalog";
import { getApprovedReviews, reviewStats } from "@/lib/data/reviews";
import { getBanners } from "@/lib/data/content";
import { getSiteUrl } from "@/lib/env";
import { ProductCard } from "@/components/product/product-card";
import { ShopControls } from "@/components/shop/shop-controls";
import { SORT_OPTIONS } from "@/lib/shop";
import { Breadcrumbs, EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { LeafSprig } from "@/components/brand/botanical";
import { JsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.slice(0, 100) ?? "";
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams;
  const collection = one(params.collection);
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === collection);
  const title = category ? category.name : "Shop";
  return {
    title,
    description: category?.description ?? "Shop UNAR Banana Chewy — chewy dehydrated banana snacks in two varieties.",
    alternates: { canonical: category ? `/shop?collection=${category.slug}` : "/shop" },
    // Search/sort variations shouldn't be indexed separately.
    robots: one(params.q) || one(params.sort) || one(params.page) ? { index: false, follow: true } : undefined,
  };
}

function sortProducts(products: Product[], sort: string): Product[] {
  const price = (p: Product) => p.defaultVariant?.price_paise ?? Number.MAX_SAFE_INTEGER;
  const list = [...products];
  switch (sort) {
    case "price_asc":
      return list.sort((a, b) => price(a) - price(b));
    case "price_desc":
      return list.sort((a, b) => price(b) - price(a));
    case "name":
      return list.sort((a, b) => (a.short_title ?? a.title).localeCompare(b.short_title ?? b.title));
    case "newest":
      return list.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
    default:
      return list.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order);
  }
}

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = one(params.q).trim();
  const collection = one(params.collection);
  const sortParam = one(params.sort);
  const sort = SORT_OPTIONS.some((o) => o.value === sortParam) ? sortParam : "featured";
  const inStock = one(params.in_stock) === "1";
  const page = Math.max(1, Number.parseInt(one(params.page) || "1", 10) || 1);

  const [products, categories, reviews, banners, settings] = await Promise.all([
    getPublishedProducts(),
    getCategories(),
    getApprovedReviews(),
    getBanners("shop_top"),
    getPublicSettings(),
  ]);

  const category = categories.find((c) => c.slug === collection) ?? null;
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = sortProducts(
    products.filter((p) => {
      if (category && !p.categories.some((c) => c.slug === category.slug)) return false;
      if (inStock && !(p.defaultVariant && p.defaultVariant.stock > 0)) return false;
      if (terms.length) {
        const haystack = [p.title, p.short_title, p.subtitle, p.short_description, p.ingredients, ...p.categories.map((c) => c.name)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!terms.every((t) => haystack.includes(t))) return false;
      }
      return true;
    }),
    sort,
  );

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const query = (overrides: Record<string, string | null>) => {
    const sp = new URLSearchParams();
    const base: Record<string, string> = { q, collection, sort: sort === "featured" ? "" : sort, in_stock: inStock ? "1" : "" };
    for (const [k, v] of Object.entries({ ...base, ...overrides })) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/shop?${s}` : "/shop";
  };

  const banner = banners[0];
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Shop", href: "/shop" },
    ...(category ? [{ name: category.name, href: `/shop?collection=${category.slug}` }] : []),
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(getSiteUrl(), crumbs)} />
      <section className="paper relative overflow-hidden border-b border-line">
        <LeafSprig className="absolute -right-2 top-4 hidden h-48 w-32 text-sage sm:block" />
        <div className="container-site relative py-12 lg:py-16">
          <Breadcrumbs items={crumbs} />
          <h1 className="mt-6 text-[2.6rem] sm:text-[3.4rem]">{category ? category.name : settings.appearance.shop_heading}</h1>
          <p className="mt-3 max-w-xl text-muted">
            {category?.description ?? (settings.appearance.shop_description || "Chewy dehydrated banana snacks — pick your favourite, or try both.")}
          </p>
        </div>
      </section>

      {banner ? (
        <div className="border-b border-line bg-banana-soft/60">
          <div className="container-site flex flex-wrap items-center justify-between gap-3 py-4 text-[0.9rem] text-forest-deep">
            <p>
              <strong className="font-semibold">{banner.title}</strong>
              {banner.body ? <span className="ml-2">{banner.body}</span> : null}
            </p>
            {banner.cta_label && banner.cta_url ? (
              <Link href={banner.cta_url} className="font-semibold underline underline-offset-4">
                {banner.cta_label}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="container-site py-10 lg:py-14">
        <div className="flex flex-col gap-6">
          {categories.length > 0 ? (
            <nav aria-label="Collections">
              <ul className="flex flex-wrap gap-2">
                <li>
                  <Link
                    href={query({ collection: null, page: null })}
                    aria-current={!category ? "page" : undefined}
                    className={cn(
                      "inline-flex h-10 items-center rounded-full border px-4 text-[0.85rem] font-medium transition-colors",
                      !category ? "border-forest bg-forest text-cream" : "border-line bg-paper text-graphite hover:border-forest",
                    )}
                  >
                    All products
                  </Link>
                </li>
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={query({ collection: c.slug, page: null })}
                      aria-current={category?.slug === c.slug ? "page" : undefined}
                      className={cn(
                        "inline-flex h-10 items-center rounded-full border px-4 text-[0.85rem] font-medium transition-colors",
                        category?.slug === c.slug
                          ? "border-forest bg-forest text-cream"
                          : "border-line bg-paper text-graphite hover:border-forest",
                      )}
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <ShopControls q={q} sort={sort} collection={collection} inStock={inStock} />
          <p className="text-[0.85rem] text-muted" aria-live="polite">
            {filtered.length === 1 ? "1 product" : `${filtered.length} products`}
            {q ? ` matching “${q}”` : ""}
          </p>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            className="mt-10"
            title={products.length === 0 ? "Products coming soon" : "No products found"}
            description={
              products.length === 0
                ? "Our Banana Chewy range will be available to order here soon."
                : "Try a different search or clear the filters."
            }
            action={products.length > 0 ? <ButtonLink href="/shop" variant="secondary">Clear filters</ButtonLink> : undefined}
          />
        ) : (
          <div className="shop-product-grid mt-10 grid gap-x-10 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                priority={i < 3}
                stats={reviewStats(reviews.filter((r) => r.product_id === product.id))}
              />
            ))}
          </div>
        )}

        {pages > 1 ? (
          <nav aria-label="Pagination" className="mt-16 flex items-center justify-center gap-2">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={query({ page: n === 1 ? null : String(n) })}
                aria-current={n === current ? "page" : undefined}
                className={cn(
                  "grid size-11 place-items-center rounded-full border text-[0.9rem]",
                  n === current ? "border-forest bg-forest text-cream" : "border-line hover:border-forest",
                )}
              >
                {n}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </>
  );
}

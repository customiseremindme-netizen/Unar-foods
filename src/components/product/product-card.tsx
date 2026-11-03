import Image from "next/image";
import Link from "next/link";
import { Badge, Price, Stars } from "@/components/ui/misc";
import { NoImage } from "@/components/layout/site-header";
import { primaryImage, variantAvailability, type Product } from "@/lib/data/catalog";
import type { ReviewStats } from "@/lib/data/reviews";
import { AddToCartButton } from "./add-to-cart";
import { QuickView } from "./quick-view";
import { WishlistButton } from "@/components/wishlist/wishlist";
import { cn } from "@/lib/utils";

export function AvailabilityBadge({ product }: { product: Product }) {
  const availability = variantAvailability(product.defaultVariant);
  if (availability === "out_of_stock" || availability === "unavailable") return <Badge tone="muted">Sold out</Badge>;
  if (availability === "low_stock") return <Badge tone="banana">Only {product.defaultVariant!.stock} left</Badge>;
  return null;
}

export function ProductCard({
  product,
  stats,
  priority,
  className,
}: {
  product: Product;
  stats?: ReviewStats | null;
  priority?: boolean;
  className?: string;
}) {
  const image = primaryImage(product);
  const hoverImage = product.images.find((i) => i.id !== image?.id && i.kind !== "back_label" && i.kind !== "front_label");
  const variant = product.defaultVariant;
  const soldOut = !variant || variant.stock <= 0;
  const name = product.title;

  return (
    <article className={cn("group relative flex flex-col", className)}>
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-square overflow-hidden rounded-[2rem] bg-cream-deep shadow-soft transition-shadow duration-500 group-hover:shadow-lift"
        aria-label={name}
      >
        {image ? (
          <>
            <Image
              src={image.url}
              alt={image.alt || name}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw"
              className="object-contain transition-transform duration-[1.2s] ease-[var(--ease-out-soft)] group-hover:scale-[1.03] motion-reduce:transition-none"
            />
            {hoverImage ? (
              <Image
                src={hoverImage.url}
                alt=""
                aria-hidden="true"
                fill
                sizes="(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw"
                className="object-contain opacity-0 transition-opacity duration-700 group-hover:opacity-100"
              />
            ) : null}
          </>
        ) : (
          <NoImage />
        )}
        <span className="absolute left-4 top-4 flex flex-wrap gap-2">
          <AvailabilityBadge product={product} />
        </span>
      </Link>
      <WishlistButton productId={product.id} productName={name} size="sm" className="absolute right-4 top-4" />
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex aspect-square items-end justify-end p-4">
        <div className="pointer-events-auto translate-y-1 opacity-100 transition-all duration-500 lg:translate-y-2 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:group-focus-within:translate-y-0 lg:group-focus-within:opacity-100">
          <QuickView
            product={{
              id: product.id,
              slug: product.slug,
              title: name,
              subtitle: product.subtitle,
              shortDescription: product.short_description,
              image: image ? { url: image.url, alt: image.alt } : null,
              variantId: variant?.id ?? null,
              variantTitle: variant?.title ?? null,
              pricePaise: variant?.price_paise ?? null,
              mrpPaise: variant?.mrp_paise ?? null,
              maxQuantity: variant ? Math.min(variant.stock, 10) : 0,
              soldOut,
            }}
          />
        </div>
      </div>
      <div className="mt-5 flex flex-1 flex-col">
        {product.subtitle ? <p className="eyebrow">{product.subtitle}</p> : null}
        <h3 className="mt-2 text-[1.3rem] leading-snug">
          <Link href={`/products/${product.slug}`} className="hover:text-forest-deep">
            {name}
          </Link>
        </h3>
        {product.short_description ? (
          <p className="mt-2 line-clamp-2 text-[0.92rem] text-muted">{product.short_description}</p>
        ) : null}
        {stats ? (
          <p className="mt-2 flex items-center gap-2 text-[0.8rem] text-muted">
            <Stars rating={stats.average} />
            <span>
              {stats.average} ({stats.count})
            </span>
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
          {variant ? (
            <div>
              <Price pricePaise={variant.price_paise} mrpPaise={variant.mrp_paise} />
              <p className="text-[0.75rem] text-muted">{variant.title}</p>
            </div>
          ) : (
            <span className="text-muted">Currently unavailable</span>
          )}
          <AddToCartButton variantId={variant?.id ?? null} disabled={soldOut} productName={name} size="sm" />
        </div>
      </div>
    </article>
  );
}

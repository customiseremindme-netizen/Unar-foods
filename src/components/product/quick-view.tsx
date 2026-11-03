"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Eye } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Price } from "@/components/ui/misc";
import { WishlistButton } from "@/components/wishlist/wishlist";
import { BuyBox } from "./add-to-cart";

export type QuickViewProduct = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  shortDescription: string | null;
  image: { url: string; alt: string } | null;
  variantId: string | null;
  variantTitle: string | null;
  pricePaise: number | null;
  mrpPaise: number | null;
  maxQuantity: number;
  soldOut: boolean;
};

/** "Quick view" on a product card: the essentials and Add to cart, without leaving the page. */
export function QuickView({ product }: { product: QuickViewProduct }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-paper/90 px-3 text-[0.78rem] font-semibold text-forest shadow-soft ring-1 ring-line backdrop-blur transition-colors hover:bg-paper"
        aria-label={`Quick view: ${product.title}`}
      >
        <Eye className="size-4" aria-hidden="true" /> Quick view
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} side="center" title={<span className="font-sans text-[0.95rem] font-semibold">Quick view</span>} labelledBy={`qv-${product.id}`}>
        <div className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-cream-deep">
            {product.image ? <Image src={product.image.url} alt={product.image.alt || product.title} fill sizes="(min-width: 640px) 20rem, 90vw" className="object-contain" /> : null}
            <WishlistButton productId={product.id} productName={product.title} size="sm" className="absolute right-3 top-3" />
          </div>
          <div className="min-w-0">
            {product.subtitle ? <p className="eyebrow">{product.subtitle}</p> : null}
            <h2 id={`qv-${product.id}`} className="mt-2 text-[1.45rem] leading-snug">
              {product.title}
            </h2>
            {product.pricePaise !== null && product.mrpPaise !== null ? (
              <div className="mt-3">
                <Price pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} />
                {product.variantTitle ? <p className="text-[0.78rem] text-muted">{product.variantTitle}</p> : null}
              </div>
            ) : null}
            {product.shortDescription ? <p className="mt-3 text-[0.9rem] leading-relaxed text-muted">{product.shortDescription}</p> : null}
            <div className="mt-5">
              <BuyBox variantId={product.variantId} maxQuantity={product.maxQuantity} productName={product.title} soldOut={product.soldOut} />
            </div>
            <Link href={`/products/${product.slug}`} onClick={() => setOpen(false)} className="mt-4 inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-forest underline underline-offset-4">
              See full details <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Sheet>
    </>
  );
}

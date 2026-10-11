"use client";

import { useState, type ReactNode } from "react";
import type { ProductVariant } from "@/lib/data/catalog";

import { Badge, Price } from "@/components/ui/misc";
import { BuyBox } from "./add-to-cart";

export function ProductOptions({ variants, productName, maxPerItem, pricesIncludeTax, children }: { variants: ProductVariant[]; productName: string; maxPerItem: number; pricesIncludeTax: boolean; children?: ReactNode }) {
  const [selected, setSelected] = useState(() => variants.find((v) => v.stock > 0)?.id ?? variants[0]?.id);
  const variant = variants.find((v) => v.id === selected) ?? variants[0];
  const availability = !variant || !variant.is_active ? "unavailable" : variant.stock <= 0 ? "out_of_stock" : variant.stock <= variant.low_stock_threshold ? "low_stock" : "in_stock";
  const soldOut = availability === "out_of_stock" || availability === "unavailable";
  return <>
    <div className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-2" aria-live="polite">
      {variant ? <Price pricePaise={variant.price_paise} mrpPaise={variant.mrp_paise} size="lg" /> : null}
      {availability === "in_stock" ? <Badge tone="success">In stock</Badge> : availability === "low_stock" ? <Badge tone="banana">Only {variant!.stock} left</Badge> : <Badge tone="muted">Sold out</Badge>}
    </div>
    {variant ? <p className="mt-2 text-[0.8rem] text-muted" data-testid="selected-variant">{pricesIncludeTax ? "Inclusive of all taxes" : "GST added at checkout"} · Size / pack: {variant.title} · SKU {variant.sku}</p> : null}
    {children}
    {variants.length > 1 ? <fieldset className="mt-6">
      <legend className="mb-3 text-[0.9rem] font-semibold text-forest">Choose a size / pack</legend>
      <div className="flex flex-wrap gap-2">{variants.map((v) => <label key={v.id} className={`cursor-pointer rounded-xl border px-4 py-3 text-[0.9rem] transition-colors ${variant?.id === v.id ? "border-forest bg-sage-soft ring-2 ring-forest/10" : "border-line bg-paper hover:border-sage"}`}>
        <input type="radio" name="product-variant" value={v.id} checked={variant?.id === v.id} onChange={() => setSelected(v.id)} className="mr-2 accent-[var(--color-forest)]" />
        {v.title}{v.stock <= 0 ? " — sold out" : ""}
      </label>)}</div>
    </fieldset> : null}
    <div className="mt-8 rounded-[1.75rem] border border-line bg-paper p-5 sm:p-6">
      <BuyBox key={variant?.id ?? "unavailable"} variantId={variant?.id ?? null} maxQuantity={variant ? Math.min(variant.stock, maxPerItem) : 0} productName={productName} soldOut={soldOut} />
    </div>
  </>;
}

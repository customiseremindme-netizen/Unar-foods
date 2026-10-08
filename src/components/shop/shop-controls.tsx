"use client";

import Form from "next/form";
import { useRef } from "react";
import { Search } from "lucide-react";
import { Select } from "@/components/ui/field";
import { SORT_OPTIONS } from "@/lib/shop";


/**
 * Search / sort / availability controls. A normal GET form, so it also
 * works without JavaScript; with JavaScript, changes apply instantly.
 */
export function ShopControls({
  q,
  sort,
  collection,
  inStock,
}: {
  q: string;
  sort: string;
  collection: string;
  inStock: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();

  return (
    <Form ref={formRef} action="/shop" className="flex flex-col gap-3 sm:flex-row sm:items-center" role="search" aria-label="Filter products">
      {collection ? <input type="hidden" name="collection" value={collection} /> : null}
      <div className="relative flex-1">
        <label htmlFor="shop-q" className="sr-only">
          Search products
        </label>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id="shop-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search products"
          className="h-12 w-full rounded-full border border-line bg-paper pl-11 pr-4 text-[0.95rem] focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15"
        />
      </div>
      <label className="flex h-12 items-center gap-2 rounded-full border border-line bg-paper px-4 text-[0.88rem]">
        <input type="checkbox" name="in_stock" value="1" defaultChecked={inStock} onChange={submit} className="size-4 accent-[var(--color-forest)]" />
        In stock only
      </label>
      <div className="sm:w-56">
        <label htmlFor="shop-sort" className="sr-only">
          Sort by
        </label>
        <Select id="shop-sort" name="sort" defaultValue={sort} onChange={submit} className="rounded-full">
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Sort: {o.label}
            </option>
          ))}
        </Select>
      </div>
      <button type="submit" className="sr-only focus:not-sr-only focus:rounded-full focus:bg-forest focus:px-4 focus:py-2 focus:text-cream">
        Apply filters
      </button>
    </Form>
  );
}

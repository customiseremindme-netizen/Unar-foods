"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { bulkProductsAction } from "@/app/admin/_actions/products";
import { Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useAdminAction } from "./forms";
import { ProductRowActions } from "./product-row-actions";

export type ProductRow = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  featured: boolean;
  image: string | null;
  skus: string[];
  sizes: number;
  stock: number;
  low: boolean;
  demo: boolean;
  minPricePaise: number | null;
};

const STATUS_TONE = { published: "success", draft: "neutral", archived: "muted" } as const;
const STATUS_LABEL = { published: "Live", draft: "Draft", archived: "Archived" } as const;

/** Product list: search, tick several rows, then publish / draft / archive / delete them together. */
export function ProductsTable({ rows, canWrite }: { rows: ProductRow[]; canWrite: boolean }) {
  const router = useRouter();
  const { run, pending } = useAdminAction();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.title.toLowerCase().includes(q) || r.skus.some((s) => s.toLowerCase().includes(q)));
  }, [rows, query]);

  const allChecked = shown.length > 0 && shown.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulk = async (op: "published" | "draft" | "archived" | "delete") => {
    const ids = [...selected];
    if (op === "delete" && !window.confirm(`Delete ${ids.length} product(s) permanently? Their reviews and stock history are deleted too. Past orders keep their own copy. Live products must be archived first.`)) return;
    const r = await run(() => bulkProductsAction(ids, op));
    if (r.ok) setSelected(new Set());
  };

  return (
    <div className="relative min-w-0 max-w-full overflow-hidden rounded-[1.5rem] border border-line bg-paper">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
        <label className="relative min-w-0 flex-1 basis-56">
          <span className="sr-only">Search products</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or SKU"
            className="h-10 w-full rounded-xl border border-line bg-cream/40 pl-9 pr-3 text-[0.88rem] outline-none focus:border-forest"
          />
        </label>
        {canWrite && selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Bulk actions">
            <span className="text-[0.82rem] font-semibold">{selected.size} selected</span>
            <Button type="button" size="sm" variant="secondary" loading={pending} onClick={() => bulk("published")}>
              Publish
            </Button>
            <Button type="button" size="sm" variant="secondary" loading={pending} onClick={() => bulk("draft")}>
              Move to drafts
            </Button>
            <Button type="button" size="sm" variant="secondary" loading={pending} onClick={() => bulk("archived")}>
              Archive
            </Button>
            <Button type="button" size="sm" variant="ghost" className="text-danger" loading={pending} onClick={() => bulk("delete")}>
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <p className="p-8 text-center text-[0.9rem] text-muted">{rows.length === 0 ? "No products here yet." : `No products match “${query}”.`}</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[0.88rem]">
            <thead className="bg-cream/50 text-[0.75rem] uppercase tracking-wide text-muted">
              <tr>
                {canWrite ? (
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Select all products"
                      checked={allChecked}
                      onChange={() => setSelected(allChecked ? new Set() : new Set(shown.map((r) => r.id)))}
                      className="size-4 accent-[var(--color-forest)]"
                    />
                  </th>
                ) : null}
                <th className="px-3 py-2.5 font-semibold">Product</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Inventory</th>
                <th className="px-3 py-2.5 text-right font-semibold">Price</th>
                <th className="px-3 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr
                  key={p.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a, button, input, [role=menu]")) return;
                    router.push(`/admin/products/${p.id}`);
                  }}
                  className={cn("cursor-pointer border-t border-line hover:bg-cream/40", selected.has(p.id) && "bg-sage-soft/30")}
                >
                  {canWrite ? (
                    <td className="px-3 py-2.5">
                      <input type="checkbox" aria-label={`Select ${p.title}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="size-4 accent-[var(--color-forest)]" />
                    </td>
                  ) : null}
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 font-semibold text-forest hover:underline">
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-cream-deep ring-1 ring-line">
                        {p.image ? <Image src={p.image} alt="" fill sizes="44px" className="object-cover" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-2">{p.title}</span>
                        {p.featured ? <Star className="ml-1 inline size-3.5 fill-banana text-banana" aria-label="Featured" /> : null}
                        <span className="block font-mono text-[0.72rem] font-normal text-muted">{p.skus.join(", ")}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    <span className={p.low ? "font-semibold text-danger" : p.stock === 0 ? "text-danger" : undefined}>{p.stock} in stock</span>
                    {p.sizes > 1 ? <span className="text-muted"> for {p.sizes} sizes</span> : null}
                    {p.demo ? <span className="ml-1 text-[0.7rem] text-muted">(demo)</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {p.minPricePaise === null ? "—" : p.minPricePaise === 0 ? <span className="text-danger">Not set</span> : formatINR(p.minPricePaise)}
                  </td>
                  <td className="px-3 py-2.5 text-right">{canWrite ? <ProductRowActions id={p.id} slug={p.slug} status={p.status} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Input, Label } from "@/components/ui/field";

export type CustomizationLink = { title: string; description: string; href: string };
export function CustomizationLinks({ items }: { items: CustomizationLink[] }) {
  const [query, setQuery] = useState("");
  const filtered = items.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section aria-label="Customization tools" className="space-y-5">
    <div className="max-w-lg"><Label htmlFor="customize-search">Find a customization tool</Label><Input id="customize-search" type="search" placeholder="Try homepage, menu, shipping or reviews" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
    {filtered.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((item) => <Link key={item.href} href={item.href} className="rounded-2xl border border-line bg-paper p-5 transition-colors hover:border-forest">
      <span className="flex items-center justify-between gap-3 font-semibold text-forest">{item.title}<ArrowUpRight aria-hidden="true" className="size-4" /></span><p className="mt-2 text-[0.85rem] leading-relaxed text-muted">{item.description}</p>
    </Link>)}</div> : <p role="status" className="text-muted">No matching tools. Try a different word.</p>}
  </section>;
}

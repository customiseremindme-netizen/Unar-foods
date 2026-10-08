import Image from "next/image";
import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/money";
import { createProductAction } from "@/app/admin/_actions/products";
import { Notice, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { Badge, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Products" };

const STATUS_TONE = { published: "success", draft: "neutral", archived: "muted" } as const;

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ error?: string; status?: string }> }) {
  const { access } = await requireStaffPage("products.read");
  const params = await searchParams;
  const supabase = (await createSupabaseServerClient())!;
  const canWrite = access.permissions.has("products.write");

  let query = supabase
    .from("products")
    .select("id, title, slug, status, is_featured, updated_at, product_variants(id, sku, price_paise, mrp_paise, stock, is_active, is_demo_stock, low_stock_threshold), product_images(url, alt, sort_order)")
    .order("sort_order")
    .order("created_at");
  if (params.status && ["draft", "published", "archived"].includes(params.status)) query = query.eq("status", params.status);
  const { data: products } = await query;

  return (
    <div>
      <PageHeader
        title="Products"
        description="Everything sold on the website. Click a product to edit its name, photos, sizes and prices, label details and SEO. Stock is changed in Inventory."
        actions={
          canWrite ? (
            <form action={createProductAction}>
              <Button type="submit" size="sm">
                <Plus className="size-4" aria-hidden="true" /> New product
              </Button>
            </form>
          ) : null
        }
      />
      {params.error ? (
        <div className="mb-5">
          <Notice tone="danger">{params.error}</Notice>
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-2 text-[0.8rem]">
        {[
          ["", "All"],
          ["published", "Live"],
          ["draft", "Drafts"],
          ["archived", "Archived"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={value ? `/admin/products?status=${value}` : "/admin/products"}
            aria-current={(params.status ?? "") === value ? "page" : undefined}
            className="rounded-full border border-line bg-paper px-3 py-1.5 hover:border-forest aria-[current=page]:border-forest aria-[current=page]:bg-forest aria-[current=page]:text-cream"
          >
            {label}
          </Link>
        ))}
      </div>
      {!products || products.length === 0 ? (
        <EmptyState title="No products here" description="Create a product with “New product”. New products start as drafts and stay hidden until you publish them." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th>Status</Th>
              <Th>SKU</Th>
              <Th className="text-right">Price</Th>
              <Th className="text-right">Stock</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const image = [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
              const variants = p.product_variants ?? [];
              const stock = variants.reduce((sum, v) => sum + v.stock, 0);
              const low = variants.some((v) => v.is_active && v.stock <= v.low_stock_threshold);
              const prices = variants.filter((v) => v.is_active).map((v) => v.price_paise);
              const demo = variants.some((v) => v.is_demo_stock);
              const status = p.status as keyof typeof STATUS_TONE;
              return (
                <tr key={p.id} className="hover:bg-cream/40">
                  <Td>
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 font-semibold text-forest hover:underline">
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-cream-deep ring-1 ring-line">
                        {image ? <Image src={image.url} alt="" fill sizes="48px" className="object-cover" /> : null}
                      </span>
                      <span>
                        {p.title}
                        {p.is_featured ? <Star className="ml-1 inline size-3.5 fill-banana text-banana" aria-label="Featured" /> : null}
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[status]}>{status === "published" ? "Live" : status}</Badge>
                  </Td>
                  <Td className="font-mono text-[0.78rem] text-muted">{variants.map((v) => v.sku).join(", ")}</Td>
                  <Td className="text-right tabular-nums">
                    {prices.length === 0 ? "—" : Math.min(...prices) === 0 ? <span className="text-danger">Not set</span> : formatINR(Math.min(...prices))}
                  </Td>
                  <Td className="text-right tabular-nums">
                    <span className={low ? "font-semibold text-danger" : undefined}>{stock}</span>
                    {demo ? <span className="ml-1 text-[0.7rem] text-muted">(demo)</span> : null}
                  </Td>
                  <Td className="text-right">
                    {canWrite ? <ProductRowActions id={p.id} slug={p.slug} status={status} /> : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}

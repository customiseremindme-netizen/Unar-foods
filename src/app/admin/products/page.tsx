import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { getUserDb } from "@/lib/db/client";
import { Notice, PageHeader } from "@/components/admin/ui";
import { ProductsTable, type ProductRow } from "@/components/admin/products-table";
import { EmptyState } from "@/components/ui/misc";

export const metadata = { title: "Products" };

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ error?: string; status?: string }> }) {
  const { access } = await requireStaffPage("products.read");
  const params = await searchParams;
  const db = (await getUserDb())!;
  const canWrite = access.permissions.has("products.write");

  let query = db
    .from("products")
    .select("id, title, slug, status, is_featured, updated_at, product_variants(id, sku, price_paise, mrp_paise, stock, is_active, is_demo_stock, low_stock_threshold), product_images(url, alt, sort_order)")
    .order("sort_order")
    .order("created_at");
  if (params.status && ["draft", "published", "archived"].includes(params.status)) query = query.eq("status", params.status);
  const [{ data: products }, { data: everything }] = await Promise.all([query, db.from("products").select("status")]);
  const counts: Record<string, number> = { "": everything?.length ?? 0 };
  for (const row of everything ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1;

  const rows: ProductRow[] = (products ?? []).map((p) => {
    const variants = p.product_variants ?? [];
    const prices = variants.filter((v) => v.is_active).map((v) => v.price_paise);
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status as ProductRow["status"],
      featured: p.is_featured,
      image: [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null,
      skus: variants.map((v) => v.sku),
      sizes: variants.length,
      stock: variants.reduce((sum, v) => sum + v.stock, 0),
      low: variants.some((v) => v.is_active && v.stock <= v.low_stock_threshold),
      demo: variants.some((v) => v.is_demo_stock),
      minPricePaise: prices.length ? Math.min(...prices) : null,
    };
  });

  return (
    <div>
      <PageHeader
        title="Products"
        description="Everything sold on the website. Click a product to edit it; tick several to publish, archive or delete them together."
        actions={
          canWrite ? (
            <Link href="/admin/products/new" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest px-4 text-[0.85rem] font-semibold text-cream hover:bg-forest-deep">
              <Plus className="size-4" aria-hidden="true" /> Add product
            </Link>
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
            {label} <span className="opacity-70">({counts[value] ?? 0})</span>
          </Link>
        ))}
      </div>
      {!products || (products.length === 0 && !params.status) ? (
        <EmptyState title="No products yet" description="Click “Add product” to create one. You can save it as a draft first." />
      ) : (
        <ProductsTable rows={rows} canWrite={canWrite} />
      )}
    </div>
  );
}

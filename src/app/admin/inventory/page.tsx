import Link from "next/link";
import { Download } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { getUserDb } from "@/lib/db/client";
import { formatDateTime } from "@/lib/utils";
import { Card, Notice, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { StockAdjuster } from "@/components/admin/stock-adjuster";
import { Badge, EmptyState } from "@/components/ui/misc";

export const metadata = { title: "Inventory" };

const REASONS: Record<string, string> = {
  initial: "Opening stock",
  restock: "New stock received",
  adjustment: "Adjustment",
  correction: "Count correction",
  damage: "Damaged / expired",
  return_restock: "Customer return",
  order_reserved: "Order placed",
  order_released: "Unpaid order released",
  order_cancelled: "Order cancelled",
  paid_after_expiry: "Late payment re-reserved",
};

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ variant?: string }> }) {
  const { access } = await requireStaffPage("inventory.read");
  const { variant: variantFilter } = await searchParams;
  const db = (await getUserDb())!;
  const canWrite = access.permissions.has("inventory.write");

  const { data: variants } = await db
    .from("product_variants")
    .select("id, title, sku, stock, low_stock_threshold, is_active, is_demo_stock, products(id, title, status)")
    .order("sku");

  let movementsQuery = db
    .from("inventory_movements")
    .select("id, delta, stock_after, reason, note, created_at, order_id, variant_id, product_variants(sku), orders(order_number)")
    .order("created_at", { ascending: false })
    .limit(80);
  if (variantFilter && /^[0-9a-f-]{36}$/.test(variantFilter)) movementsQuery = movementsQuery.eq("variant_id", variantFilter);
  const { data: movements } = await movementsQuery;

  const rows = (variants ?? []).filter((v) => v.products);
  const demo = rows.some((v) => v.is_demo_stock);
  const low = rows.filter((v) => v.is_active && v.stock <= v.low_stock_threshold);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Inventory"
        description="How many packs you have to sell. Stock goes down automatically when an order is placed and comes back if an unpaid order expires or an order is cancelled."
        actions={
          <a href="/admin/export/inventory" className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-[0.85rem] font-semibold text-forest hover:border-forest">
            <Download className="size-4" aria-hidden="true" /> Export CSV
          </a>
        }
      />
      {demo ? (
        <Notice tone="warning">
          Some stock numbers are <strong>demo values</strong> from the test setup. Enter your real stock count (use “Set to” with reason “Opening stock”) before going live.
        </Notice>
      ) : null}
      {low.length ? (
        <Notice tone="danger">
          Low stock: {low.map((v) => `${v.sku} (${v.stock})`).join(", ")}.
        </Notice>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState title="No products yet" description="Add a product first, then set its stock here." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Product / size</Th>
              <Th>SKU</Th>
              <Th className="text-right">In stock</Th>
              <Th>Status</Th>
              <Th>{canWrite ? "Change stock" : ""}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const isLow = v.stock <= v.low_stock_threshold;
              return (
                <tr key={v.id} className="align-top">
                  <Td>
                    <Link href={`/admin/products/${v.products!.id}`} className="font-semibold text-forest hover:underline">
                      {v.products!.title}
                    </Link>
                    <span className="block text-[0.78rem] text-muted">
                      {v.title}
                      {v.products!.status !== "published" ? ` · ${v.products!.status}` : ""}
                      {!v.is_active ? " · not available" : ""}
                    </span>
                  </Td>
                  <Td className="font-mono text-[0.78rem]">{v.sku}</Td>
                  <Td className="text-right">
                    <span className={`font-display text-[1.4rem] tabular-nums ${v.stock === 0 ? "text-danger" : isLow ? "text-[#8a6200]" : "text-forest"}`}>{v.stock}</span>
                    {v.is_demo_stock ? <span className="block text-[0.7rem] text-muted">demo</span> : null}
                    <span className="block text-[0.7rem] text-muted">alert at {v.low_stock_threshold}</span>
                  </Td>
                  <Td>
                    {v.stock === 0 ? <Badge tone="danger">Sold out</Badge> : isLow ? <Badge tone="banana">Low</Badge> : <Badge tone="success">In stock</Badge>}
                    <Link href={`/admin/inventory?variant=${v.id}#history`} className="mt-2 block text-[0.75rem] text-forest underline">
                      History
                    </Link>
                  </Td>
                  <Td>{canWrite ? <StockAdjuster variantId={v.id} current={v.stock} /> : null}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Card
        id="history"
        title="Stock history"
        description={variantFilter ? <Link href="/admin/inventory#history" className="text-forest underline">Show all sizes</Link> : "The latest 80 stock changes."}
      >
        {!movements || movements.length === 0 ? (
          <p className="text-[0.88rem] text-muted">No stock changes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[0.84rem]">
              <thead className="text-[0.72rem] uppercase tracking-[0.1em] text-muted">
                <tr>
                  <th className="py-2 pr-3 font-semibold">When</th>
                  <th className="py-2 pr-3 font-semibold">SKU</th>
                  <th className="py-2 pr-3 text-right font-semibold">Change</th>
                  <th className="py-2 pr-3 text-right font-semibold">After</th>
                  <th className="py-2 pr-3 font-semibold">Reason</th>
                  <th className="py-2 font-semibold">Note / order</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t border-line/70">
                    <td className="py-2 pr-3 text-muted">{formatDateTime(m.created_at)}</td>
                    <td className="py-2 pr-3 font-mono text-[0.76rem]">{m.product_variants?.sku}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${m.delta < 0 ? "text-danger" : "text-success"}`}>
                      {m.delta > 0 ? "+" : ""}
                      {m.delta}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{m.stock_after}</td>
                    <td className="py-2 pr-3">{REASONS[m.reason] ?? m.reason}</td>
                    <td className="py-2 text-muted">
                      {m.order_id && m.orders ? (
                        <Link href={`/admin/orders/${m.order_id}`} className="text-forest underline">
                          {m.orders.order_number}
                        </Link>
                      ) : null}{" "}
                      {m.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

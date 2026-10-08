import Link from "next/link";
import { CircleCheck, Circle, TriangleAlert } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/admin/date-range";
import { getLaunchChecklist } from "@/lib/admin/checklist";
import { releaseExpiredReservations } from "@/lib/commerce/checkout";
import { formatINR } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { orderStatusLabel } from "@/lib/orders/view";
import { Card, Notice, PageHeader, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { RangeFilter } from "@/components/admin/range-filter";
import { RevenueChart, type DailyPoint } from "@/components/admin/revenue-chart";
import { Badge } from "@/components/ui/misc";

type Summary = {
  paid_orders: number;
  gross_revenue_paise: number;
  refunds_paise: number;
  discounts_paise: number;
  orders_to_fulfil: number;
  awaiting_payment: number;
  cod_pending_orders: number;
  cod_pending_paise: number;
  needs_attention: number;
  low_stock_variants: number;
  new_customers: number;
};

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { access } = await requireStaffPage("dashboard.view");
  const params = await searchParams;
  const range = resolveRange(params);
  const supabase = (await createSupabaseServerClient())!;
  const canReports = access.permissions.has("reports.view");
  const canOrders = access.permissions.has("orders.read");

  // Housekeeping: release stock held by abandoned payments.
  if (canOrders) await releaseExpiredReservations(10).catch(() => undefined);

  const [summaryRes, dailyRes, productsRes, recentRes, lowStockRes, checklist] = await Promise.all([
    canReports ? supabase.rpc("report_summary", { p_from: range.from.toISOString(), p_to: range.to.toISOString() }) : Promise.resolve({ data: null }),
    canReports ? supabase.rpc("report_daily_sales", { p_from: range.from.toISOString(), p_to: range.to.toISOString() }) : Promise.resolve({ data: null }),
    canReports ? supabase.rpc("report_product_sales", { p_from: range.from.toISOString(), p_to: range.to.toISOString() }) : Promise.resolve({ data: null }),
    canOrders
      ? supabase
          .from("orders")
          .select("id, order_number, customer_name, total_paise, status, payment_status, fulfillment_status, payment_method, created_at, needs_attention")
          .order("created_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: null }),
    access.permissions.has("inventory.read")
      ? supabase.from("product_variants").select("id, title, sku, stock, low_stock_threshold, products(title, status)").eq("is_active", true)
      : Promise.resolve({ data: null }),
    access.permissions.has("settings.write") ? getLaunchChecklist() : Promise.resolve(null),
  ]);

  let s = (summaryRes.data ?? null) as Summary | null;
  // Staff without report access still need their work queue counts.
  if (!s && canOrders) {
    const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
    const head = { count: "exact" as const, head: true };
    const [toFulfil, awaiting, cod, attention] = await Promise.all([
      count(
        supabase
          .from("orders")
          .select("id", head)
          .eq("status", "placed")
          .in("fulfillment_status", ["unfulfilled", "processing", "packed"])
          .in("payment_status", ["paid", "partially_refunded", "cod_pending"]),
      ),
      count(supabase.from("orders").select("id", head).eq("status", "pending_payment")),
      count(supabase.from("orders").select("id", head).eq("status", "placed").eq("payment_status", "cod_pending")),
      count(supabase.from("orders").select("id", head).eq("needs_attention", true)),
    ]);
    s = {
      paid_orders: 0,
      gross_revenue_paise: 0,
      refunds_paise: 0,
      discounts_paise: 0,
      orders_to_fulfil: toFulfil,
      awaiting_payment: awaiting,
      cod_pending_orders: cod,
      cod_pending_paise: 0,
      needs_attention: attention,
      low_stock_variants: 0,
      new_customers: 0,
    };
  }
  const daily = (dailyRes.data ?? []) as DailyPoint[];
  const topProducts = ((productsRes.data ?? []) as { title: string; sku: string; units: number; revenue_paise: number }[]).slice(0, 5);
  const lowStock = ((lowStockRes.data ?? []) as unknown as { id: string; title: string; sku: string; stock: number; low_stock_threshold: number; products: { title: string; status: string } | null }[]).filter(
    (v) => v.stock <= v.low_stock_threshold && v.products?.status !== "archived",
  );
  const net = s ? s.gross_revenue_paise - s.refunds_paise : 0;
  const remaining = checklist?.filter((c) => !c.done).length ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader title="Overview" description="Real figures from paid orders only. Revenue is counted when payment is received." />

      {checklist && remaining > 0 ? (
        <Card title={`Launch checklist — ${remaining} step${remaining === 1 ? "" : "s"} left`} description="Complete these before taking real orders.">
          <ul className="grid gap-2 md:grid-cols-2">
            {checklist.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="flex gap-3 rounded-xl p-3 transition-colors hover:bg-forest/[0.04]">
                  {item.done ? (
                    <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-label="Done" />
                  ) : (
                    <Circle className="mt-0.5 size-5 shrink-0 text-muted" aria-label="To do" />
                  )}
                  <span>
                    <span className={item.done ? "text-muted line-through" : "font-semibold text-forest"}>{item.label}</span>
                    <span className="block text-[0.8rem] text-muted">{item.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {s && s.needs_attention > 0 ? (
        <Notice tone="danger">
          <TriangleAlert className="mr-2 inline size-4" aria-hidden="true" />
          {s.needs_attention} order(s) need your attention.{" "}
          <Link href="/admin/orders?attention=1" className="font-semibold underline">
            Review now
          </Link>
        </Notice>
      ) : null}

      {canReports ? (
        <>
          <RangeFilter basePath="/admin" range={range} />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Paid revenue" value={formatINR(s?.gross_revenue_paise ?? 0)} hint={range.label} />
            <StatCard label="Paid orders" value={s?.paid_orders ?? 0} hint={s && s.paid_orders > 0 ? `Avg ${formatINR(Math.round(s.gross_revenue_paise / s.paid_orders))}` : "—"} />
            <StatCard label="Refunds" value={formatINR(s?.refunds_paise ?? 0)} hint={`Net ${formatINR(net)}`} />
            <StatCard label="New customers" value={s?.new_customers ?? 0} hint="Accounts created" />
          </div>
        </>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="To fulfil" value={s?.orders_to_fulfil ?? "—"} href="/admin/orders?view=to_fulfil" hint="Paid / COD orders not shipped" />
        <StatCard label="Awaiting payment" value={s?.awaiting_payment ?? "—"} href="/admin/orders?status=pending_payment" hint="Stock reserved temporarily" />
        <StatCard label="COD to collect" value={s ? (canReports ? formatINR(s.cod_pending_paise) : s.cod_pending_orders) : "—"} hint={s ? `${s.cod_pending_orders} order(s)` : undefined} href="/admin/orders?payment=cod_pending" />
        <StatCard
          label="Low stock"
          value={lowStock.length}
          tone={lowStock.length > 0 ? "warning" : "default"}
          href="/admin/inventory"
          hint={lowStock.length ? "At or below threshold" : "All good"}
        />
      </div>

      {canReports ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card title="Paid revenue per day" className="xl:col-span-2">
            <RevenueChart data={daily} />
          </Card>
          <Card title="Best sellers" description={range.label}>
            {topProducts.length === 0 ? (
              <p className="text-[0.88rem] text-muted">No paid sales in this period yet.</p>
            ) : (
              <ol className="space-y-3">
                {topProducts.map((p, i) => (
                  <li key={p.sku} className="flex items-center justify-between gap-3 text-[0.88rem]">
                    <span className="min-w-0">
                      <span className="mr-2 text-muted">{i + 1}.</span>
                      <span className="font-semibold text-forest">{p.title}</span>
                      <span className="block text-[0.78rem] text-muted">{p.units} sold</span>
                    </span>
                    <span className="tabular-nums">{formatINR(p.revenue_paise)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      ) : null}

      {recentRes.data ? (
        <Card title="Recent orders" actions={<Link href="/admin/orders" className="text-[0.82rem] font-semibold text-forest underline">All orders</Link>}>
          {recentRes.data.length === 0 ? (
            <p className="text-[0.88rem] text-muted">No orders yet.</p>
          ) : (
            <Table className="border-0">
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Placed</Th>
                </tr>
              </thead>
              <tbody>
                {recentRes.data.map((o) => {
                  const st = orderStatusLabel(o);
                  return (
                    <tr key={o.id} className="hover:bg-cream/40">
                      <Td>
                        <Link href={`/admin/orders/${o.id}`} className="font-semibold text-forest hover:underline">
                          {o.order_number}
                        </Link>
                        {o.needs_attention ? <TriangleAlert className="ml-1 inline size-3.5 text-danger" aria-label="Needs attention" /> : null}
                      </Td>
                      <Td>{o.customer_name}</Td>
                      <Td>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </Td>
                      <Td className="text-right tabular-nums">{formatINR(o.total_paise)}</Td>
                      <Td className="text-muted">{formatDateTime(o.created_at)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}
    </div>
  );
}

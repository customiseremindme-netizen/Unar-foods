import Link from "next/link";
import { Download, TriangleAlert } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/admin/date-range";
import { formatINR } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { orderStatusLabel } from "@/lib/orders/view";
import { FilterBar, PageHeader, Pagination, Table, Td, Th, smallInput } from "@/components/admin/ui";
import { Badge, EmptyState } from "@/components/ui/misc";

const PAGE_SIZE = 25;

export const metadata = { title: "Orders" };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaffPage("orders.read");
  const params = await searchParams;
  const supabase = (await createSupabaseServerClient())!;
  const page = Math.max(1, Number(params.page) || 1);
  const q = (params.q ?? "").trim().slice(0, 80);
  const useRange = !!(params.from && params.to);
  const range = resolveRange({ range: "custom", from: params.from, to: params.to });

  let query = supabase
    .from("orders")
    .select("id, order_number, customer_name, email, phone, total_paise, status, payment_status, fulfillment_status, payment_method, created_at, needs_attention", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (params.status) query = query.eq("status", params.status);
  if (params.payment) query = query.eq("payment_status", params.payment);
  if (params.fulfillment) query = query.eq("fulfillment_status", params.fulfillment);
  if (params.attention === "1") query = query.eq("needs_attention", true);
  if (params.view === "to_fulfil") {
    query = query.eq("status", "placed").in("fulfillment_status", ["unfulfilled", "processing", "packed"]).in("payment_status", ["paid", "partially_refunded", "cod_pending"]);
  }
  if (useRange) query = query.gte("created_at", range.from.toISOString()).lt("created_at", range.to.toISOString());
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(`order_number.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%,customer_name.ilike.%${safe}%`);
  }

  const { data: orders, count } = await query;
  const pages = Math.ceil((count ?? 0) / PAGE_SIZE);
  const qs = (overrides: Record<string, string | null>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...overrides })) if (v) sp.set(k, v);
    return `/admin/orders?${sp.toString()}`;
  };
  const exportParams = new URLSearchParams(Object.entries(params).filter(([k, v]) => v && k !== "page") as [string, string][]);

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Every order placed on the website. Click an order to update its status, add tracking, cancel or refund."
        actions={
          <a href={`/admin/export/orders?${exportParams.toString()}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-[0.85rem] font-semibold text-forest hover:border-forest">
            <Download className="size-4" aria-hidden="true" /> Export CSV
          </a>
        }
      />
      <FilterBar>
        <form className="flex flex-wrap items-end gap-3" action="/admin/orders">
          <label className="text-[0.75rem] text-muted">
            Search
            <input name="q" defaultValue={q} placeholder="Order no., name, email, phone" className={`${smallInput} mt-1 block w-64`} />
          </label>
          <label className="text-[0.75rem] text-muted">
            Order status
            <select name="status" defaultValue={params.status ?? ""} className={`${smallInput} mt-1 block`}>
              <option value="">All</option>
              <option value="placed">Placed</option>
              <option value="pending_payment">Awaiting payment</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
              <option value="payment_failed">Payment failed</option>
            </select>
          </label>
          <label className="text-[0.75rem] text-muted">
            Payment
            <select name="payment" defaultValue={params.payment ?? ""} className={`${smallInput} mt-1 block`}>
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="cod_pending">COD to collect</option>
              <option value="cod_collected">COD collected</option>
              <option value="partially_refunded">Partly refunded</option>
              <option value="refunded">Refunded</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label className="text-[0.75rem] text-muted">
            Fulfilment
            <select name="fulfillment" defaultValue={params.fulfillment ?? ""} className={`${smallInput} mt-1 block`}>
              <option value="">All</option>
              <option value="unfulfilled">Unfulfilled</option>
              <option value="processing">Processing</option>
              <option value="packed">Packed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="returned">Returned</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="text-[0.75rem] text-muted">
            Placed between
            <span className="mt-1 flex gap-1">
              <input type="date" name="from" defaultValue={useRange ? range.fromStr : ""} className={smallInput} />
              <input type="date" name="to" defaultValue={useRange ? range.toStr : ""} className={smallInput} />
            </span>
          </label>
          <button className="h-10 rounded-full bg-forest px-5 text-[0.85rem] font-semibold text-cream">Filter</button>
          <Link href="/admin/orders" className="h-10 content-center text-[0.82rem] text-forest underline">
            Clear
          </Link>
        </form>
      </FilterBar>
      <div className="mb-4 flex flex-wrap gap-2 text-[0.8rem]">
        <Link href="/admin/orders?view=to_fulfil" className="rounded-full border border-line bg-paper px-3 py-1.5 hover:border-forest">
          To fulfil
        </Link>
        <Link href="/admin/orders?attention=1" className="rounded-full border border-line bg-paper px-3 py-1.5 hover:border-forest">
          Needs attention
        </Link>
        <Link href="/admin/orders?payment=cod_pending" className="rounded-full border border-line bg-paper px-3 py-1.5 hover:border-forest">
          COD to collect
        </Link>
      </div>
      {!orders || orders.length === 0 ? (
        <EmptyState title="No orders found" description="Orders will appear here as soon as customers place them." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th>Status</Th>
              <Th>Payment</Th>
              <Th className="text-right">Total</Th>
              <Th>Placed</Th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const st = orderStatusLabel(o);
              return (
                <tr key={o.id} className="hover:bg-cream/40">
                  <Td>
                    <Link href={`/admin/orders/${o.id}`} className="font-semibold text-forest hover:underline">
                      {o.order_number}
                    </Link>
                    {o.needs_attention ? <TriangleAlert className="ml-1 inline size-3.5 text-danger" aria-label="Needs attention" /> : null}
                  </Td>
                  <Td>
                    <span className="block">{o.customer_name}</span>
                    <span className="text-[0.78rem] text-muted">{o.email}</span>
                  </Td>
                  <Td>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </Td>
                  <Td className="text-[0.8rem] text-muted">
                    {o.payment_method === "cod" ? "COD" : "Online"} · {o.payment_status.replace(/_/g, " ")}
                  </Td>
                  <Td className="text-right tabular-nums">{formatINR(o.total_paise)}</Td>
                  <Td className="text-muted">{formatDateTime(o.created_at)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pages={pages} makeHref={(p) => qs({ page: String(p) })} />
    </div>
  );
}

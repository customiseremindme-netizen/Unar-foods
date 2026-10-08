import Link from "next/link";
import { Download } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { FilterBar, PageHeader, Pagination, Table, Td, Th, smallInput } from "@/components/admin/ui";
import { Badge, EmptyState } from "@/components/ui/misc";

export const metadata = { title: "Customers" };
const PAGE_SIZE = 30;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireStaffPage("customers.read");
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number(params.page) || 1);
  const supabase = (await createSupabaseServerClient())!;
  const { data: customers } = await supabase.rpc("admin_customers", { p_search: q, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE });
  const total = Number(customers?.[0]?.total_count ?? 0);

  return (
    <div>
      <PageHeader
        title="Customers"
        description="People who created an account or placed an order. Guest shoppers appear here once they order."
        actions={
          <a href={`/admin/export/customers?q=${encodeURIComponent(q)}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-[0.85rem] font-semibold text-forest hover:border-forest">
            <Download className="size-4" aria-hidden="true" /> Export CSV
          </a>
        }
      />
      <FilterBar>
        <form action="/admin/customers" className="flex flex-wrap items-end gap-3">
          <label className="text-[0.75rem] text-muted">
            Search
            <input name="q" defaultValue={q} placeholder="Name, email or phone" className={`${smallInput} mt-1 block w-72`} />
          </label>
          <button className="h-10 rounded-full bg-forest px-5 text-[0.85rem] font-semibold text-cream">Search</button>
          {q ? (
            <Link href="/admin/customers" className="h-10 content-center text-[0.82rem] text-forest underline">
              Clear
            </Link>
          ) : null}
        </form>
      </FilterBar>
      {!customers || customers.length === 0 ? (
        <EmptyState title="No customers yet" description="Customers will appear here when they sign up or place an order." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Type</Th>
              <Th className="text-right">Orders</Th>
              <Th className="text-right">Total spent</Th>
              <Th>Last order</Th>
              <Th>Emails OK</Th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.email} className="hover:bg-cream/40">
                <Td>
                  <Link href={`/admin/customers/${encodeURIComponent(c.email)}`} className="font-semibold text-forest hover:underline">
                    {c.full_name || c.email}
                  </Link>
                  <span className="block text-[0.78rem] text-muted">
                    {c.email}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </span>
                </Td>
                <Td>{c.is_registered ? <Badge tone="sage">Account</Badge> : <Badge tone="muted">Guest</Badge>}</Td>
                <Td className="text-right tabular-nums">{c.orders_count}</Td>
                <Td className="text-right tabular-nums">{formatINR(Number(c.total_spent_paise))}</Td>
                <Td className="text-muted">{formatDate(c.last_order_at)}</Td>
                <Td>{c.marketing_consent ? "Yes" : "No"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination
        page={page}
        pages={Math.ceil(total / PAGE_SIZE)}
        makeHref={(p) => `/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) }).toString()}`}
      />
    </div>
  );
}

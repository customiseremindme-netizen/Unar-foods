import Link from "next/link";
import { Download } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { getUserDb } from "@/lib/db/client";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { FilterBar, PageHeader, Pagination, Table, Td, Th, smallInput } from "@/components/admin/ui";
import { Badge, EmptyState } from "@/components/ui/misc";

export const metadata = { title: "Customers" };
const PAGE_SIZE = 30;

const SORTS = [
  ["recent", "Latest order"],
  ["spent", "Most spent"],
  ["orders", "Most orders"],
  ["newest", "Newest customers"],
  ["name", "Name A–Z"],
] as const;
const FILTERS = [
  ["all", "Everyone"],
  ["buyers", "Has bought"],
  ["repeat", "Bought more than once"],
  ["no_orders", "Hasn't bought yet"],
  ["registered", "Has an account"],
  ["guests", "Guest checkout only"],
  ["subscribed", "Agreed to marketing emails"],
] as const;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sort?: string; filter?: string }> }) {
  await requireStaffPage("customers.read");
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number(params.page) || 1);
  const db = (await getUserDb())!;
  const sort = SORTS.some(([v]) => v === params.sort) ? params.sort! : "recent";
  const filter = FILTERS.some(([v]) => v === params.filter) ? params.filter! : "all";
  const { data: customers } = await db.rpc("admin_customers", { p_search: q, p_sort: sort, p_filter: filter, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE });
  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...(q ? { q } : {}), ...(sort !== "recent" ? { sort } : {}), ...(filter !== "all" ? { filter } : {}), ...extra }).toString();
  const total = Number(customers?.[0]?.total_count ?? 0);

  return (
    <div>
      <PageHeader
        title="Customers"
        description="People who created an account or placed an order. Guest shoppers appear here once they order."
        actions={
          <a href={`/admin/export/customers?${qs({})}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-[0.85rem] font-semibold text-forest hover:border-forest">
            <Download className="size-4" aria-hidden="true" /> Export CSV
          </a>
        }
      />
      <FilterBar>
        <form action="/admin/customers" className="flex flex-wrap items-end gap-3">
          <label className="text-[0.75rem] text-muted">
            Search
            <input name="q" defaultValue={q} placeholder="Name, email or phone" className={`${smallInput} mt-1 block w-full sm:w-72`} />
          </label>
          <label className="text-[0.75rem] text-muted">
            Show
            <select name="filter" defaultValue={filter} className={`${smallInput} mt-1 block`}>
              {FILTERS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[0.75rem] text-muted">
            Sort by
            <select name="sort" defaultValue={sort} className={`${smallInput} mt-1 block`}>
              {SORTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <button className="h-10 rounded-full bg-forest px-5 text-[0.85rem] font-semibold text-cream">Apply</button>
          {q || sort !== "recent" || filter !== "all" ? (
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
        makeHref={(p) => `/admin/customers?${qs({ page: String(p) })}`}
      />
    </div>
  );
}

import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { FilterBar, PageHeader, Pagination, Table, Td, Th, smallInput } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/misc";

export const metadata = { title: "Activity log" };
const PAGE_SIZE = 50;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireStaffPage("audit.view");
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 60).replace(/[%,()]/g, " ");
  const page = Math.max(1, Number(params.page) || 1);
  const supabase = (await createSupabaseServerClient())!;
  let query = supabase
    .from("audit_logs")
    .select("id, actor_email, action, entity_type, entity_id, summary, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(`summary.ilike.%${q}%,actor_email.ilike.%${q}%,action.ilike.%${q}%`);
  const { data, count } = await query;

  return (
    <div>
      <PageHeader title="Activity log" description="A record of every change made in the dashboard: who did what, and when. It can't be edited or deleted from here." />
      <FilterBar>
        <form action="/admin/activity" className="flex flex-wrap items-end gap-3">
          <label className="text-[0.75rem] text-muted">
            Search
            <input name="q" defaultValue={params.q ?? ""} placeholder="e.g. refund, product, email" className={`${smallInput} mt-1 block w-72`} />
          </label>
          <button className="h-10 rounded-full bg-forest px-5 text-[0.85rem] font-semibold text-cream">Search</button>
          {q ? (
            <Link href="/admin/activity" className="h-10 content-center text-[0.82rem] text-forest underline">
              Clear
            </Link>
          ) : null}
        </form>
      </FilterBar>
      {!data?.length ? (
        <EmptyState title="No activity yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>What</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id}>
                <Td className="whitespace-nowrap text-muted">{formatDateTime(a.created_at)}</Td>
                <Td className="text-[0.82rem]">{a.actor_email ?? "System"}</Td>
                <Td>
                  {a.entity_type === "order" && a.entity_id ? (
                    <Link href={`/admin/orders/${a.entity_id}`} className="text-forest hover:underline">
                      {a.summary ?? a.action}
                    </Link>
                  ) : a.entity_type === "product" && a.entity_id ? (
                    <Link href={`/admin/products/${a.entity_id}`} className="text-forest hover:underline">
                      {a.summary ?? a.action}
                    </Link>
                  ) : (
                    a.summary ?? a.action
                  )}
                  <span className="block font-mono text-[0.7rem] text-muted">{a.action}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pages={Math.ceil((count ?? 0) / PAGE_SIZE)} makeHref={(p) => `/admin/activity?q=${encodeURIComponent(q)}&page=${p}`} />
    </div>
  );
}

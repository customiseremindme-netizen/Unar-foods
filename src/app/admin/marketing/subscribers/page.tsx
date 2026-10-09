import Link from "next/link";
import { Download } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { getUserDb } from "@/lib/db/client";
import { formatDateTime } from "@/lib/utils";
import { FilterBar, PageHeader, Pagination, Table, Td, Th, smallInput } from "@/components/admin/ui";
import { SubscriberActions } from "@/components/admin/subscriber-actions";
import { Badge, EmptyState } from "@/components/ui/misc";

export const metadata = { title: "Subscribers" };
const PAGE_SIZE = 50;

export default async function SubscribersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  await requireStaffPage("marketing.write");
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80).replace(/[%,()]/g, " ");
  const status = params.status === "unsubscribed" ? "unsubscribed" : params.status === "all" ? "all" : "subscribed";
  const page = Math.max(1, Number(params.page) || 1);
  const db = (await getUserDb())!;
  let query = db
    .from("subscribers")
    .select("id, email, status, source, consent_at, consent_text, unsubscribed_at", { count: "exact" })
    .order("consent_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.ilike("email", `%${q}%`);
  const { data, count } = await query;

  return (
    <div>
      <PageHeader
        title="Newsletter subscribers"
        description="People who ticked the newsletter box and agreed to marketing emails. Every email you send must include an unsubscribe link — your email tool does this for you."
        actions={
          <a href={`/admin/export/subscribers?status=${status}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-[0.85rem] font-semibold text-forest hover:border-forest">
            <Download className="size-4" aria-hidden="true" /> Export CSV
          </a>
        }
      />
      <FilterBar>
        <form action="/admin/marketing/subscribers" className="flex flex-wrap items-end gap-3">
          <label className="text-[0.75rem] text-muted">
            Search
            <input name="q" defaultValue={params.q ?? ""} placeholder="Email" className={`${smallInput} mt-1 block w-64`} />
          </label>
          <label className="text-[0.75rem] text-muted">
            Show
            <select name="status" defaultValue={status} className={`${smallInput} mt-1 block`}>
              <option value="subscribed">Subscribed</option>
              <option value="unsubscribed">Unsubscribed</option>
              <option value="all">All</option>
            </select>
          </label>
          <button className="h-10 rounded-full bg-forest px-5 text-[0.85rem] font-semibold text-cream">Filter</button>
          <Link href="/admin/marketing/subscribers" className="h-10 content-center text-[0.82rem] text-forest underline">
            Clear
          </Link>
        </form>
      </FilterBar>
      {!data || data.length === 0 ? (
        <EmptyState title="No subscribers" description="Sign-ups from the newsletter form appear here." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Signed up</Th>
              <Th>Source</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id}>
                <Td>
                  {s.email}
                  <span className="block max-w-sm truncate text-[0.72rem] text-muted" title={s.consent_text}>
                    Agreed to: “{s.consent_text}”
                  </span>
                </Td>
                <Td>{s.status === "subscribed" ? <Badge tone="success">Subscribed</Badge> : <Badge tone="muted">Unsubscribed {s.unsubscribed_at ? formatDateTime(s.unsubscribed_at) : ""}</Badge>}</Td>
                <Td className="text-muted">{formatDateTime(s.consent_at)}</Td>
                <Td className="text-muted">{s.source ?? "—"}</Td>
                <Td className="text-right">
                  <SubscriberActions id={s.id} subscribed={s.status === "subscribed"} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pages={Math.ceil((count ?? 0) / PAGE_SIZE)} makeHref={(p) => `/admin/marketing/subscribers?status=${status}&q=${encodeURIComponent(q)}&page=${p}`} />
    </div>
  );
}

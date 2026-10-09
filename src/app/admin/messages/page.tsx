import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { getUserDb } from "@/lib/db/client";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, Pagination } from "@/components/admin/ui";
import { MessageActions } from "@/components/admin/moderation";
import { Badge, EmptyState } from "@/components/ui/misc";

export const metadata = { title: "Messages" };
const PAGE_SIZE = 20;

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; open?: string }> }) {
  await requireStaffPage("customers.read");
  const params = await searchParams;
  const status = ["new", "read", "archived"].includes(params.status ?? "") ? params.status! : "inbox";
  const page = Math.max(1, Number(params.page) || 1);
  const db = (await getUserDb())!;
  let query = db
    .from("contact_messages")
    .select("id, name, email, phone, subject, message, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  query = status === "inbox" ? query.neq("status", "archived") : query.eq("status", status);
  const { data: messages, count } = await query;

  return (
    <div>
      <PageHeader title="Messages" description="Messages sent through the Contact page. Reply from your own email — click the address to open your mail app." />
      <div className="mb-4 flex flex-wrap gap-2 text-[0.8rem]">
        {[
          ["inbox", "Inbox"],
          ["new", "Unread"],
          ["archived", "Archived"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={`/admin/messages?status=${value}`}
            aria-current={status === value ? "page" : undefined}
            className="rounded-full border border-line bg-paper px-3 py-1.5 hover:border-forest aria-[current=page]:border-forest aria-[current=page]:bg-forest aria-[current=page]:text-cream"
          >
            {label}
          </Link>
        ))}
      </div>
      {!messages || messages.length === 0 ? (
        <EmptyState title="No messages" description="Messages from the Contact page will appear here." />
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.id}>
              <details open={params.open === m.id || m.status === "new"} className="group rounded-[1.25rem] border border-line bg-paper">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                  {m.status === "new" ? <Badge tone="banana">New</Badge> : null}
                  <span className="font-semibold text-forest">{m.subject || "(no subject)"}</span>
                  <span className="text-[0.82rem] text-muted">
                    {m.name} · {formatDateTime(m.created_at)}
                  </span>
                </summary>
                <div className="border-t border-line px-5 py-4">
                  <p className="mb-3 text-[0.82rem] text-muted">
                    <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject ?? "Your message to UNAR"}`)}`} className="text-forest underline">
                      {m.email}
                    </a>
                    {m.phone ? (
                      <>
                        {" · "}
                        <a href={`tel:+91${m.phone}`} className="text-forest underline">
                          {m.phone}
                        </a>
                      </>
                    ) : null}
                    {" · "}
                    <Link href={`/admin/customers/${encodeURIComponent(m.email)}`} className="text-forest underline">
                      Customer details
                    </Link>
                  </p>
                  <p className="whitespace-pre-wrap text-[0.92rem] leading-relaxed">{m.message}</p>
                  <MessageActions id={m.id} status={m.status as "new" | "read" | "archived"} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} pages={Math.ceil((count ?? 0) / PAGE_SIZE)} makeHref={(p) => `/admin/messages?status=${status}&page=${p}`} />
    </div>
  );
}

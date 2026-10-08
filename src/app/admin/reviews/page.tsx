import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, Pagination } from "@/components/admin/ui";
import { ReviewModeration } from "@/components/admin/moderation";
import { Badge, EmptyState, Stars } from "@/components/ui/misc";

export const metadata = { title: "Reviews" };
const PAGE_SIZE = 20;
const TABS = [
  ["pending", "Waiting"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["spam", "Spam"],
] as const;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireStaffPage("reviews.moderate");
  const params = await searchParams;
  const status = TABS.some(([v]) => v === params.status) ? params.status! : "pending";
  const page = Math.max(1, Number(params.page) || 1);
  const supabase = (await createSupabaseServerClient())!;
  const { data: reviews, count } = await supabase
    .from("reviews")
    .select("id, author_name, rating, title, body, status, is_verified_purchase, admin_reply, created_at, products(title, slug)", { count: "exact" })
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  return (
    <div>
      <PageHeader
        title="Reviews"
        description="Reviews written by customers. Nothing is shown on the website until you approve it. Never edit what a customer wrote — approve, reject or reply instead."
      />
      <div className="mb-4 flex flex-wrap gap-2 text-[0.8rem]">
        {TABS.map(([value, label]) => (
          <Link
            key={value}
            href={`/admin/reviews?status=${value}`}
            aria-current={status === value ? "page" : undefined}
            className="rounded-full border border-line bg-paper px-3 py-1.5 hover:border-forest aria-[current=page]:border-forest aria-[current=page]:bg-forest aria-[current=page]:text-cream"
          >
            {label}
          </Link>
        ))}
      </div>
      {!reviews || reviews.length === 0 ? (
        <EmptyState title="Nothing here" description={status === "pending" ? "No reviews are waiting for approval." : "No reviews in this list."} />
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-[1.25rem] border border-line bg-paper p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Stars rating={r.rating} label={`${r.rating} out of 5`} />
                <span className="font-semibold">{r.title || "(no title)"}</span>
                {r.is_verified_purchase ? <Badge tone="sage">Verified buyer</Badge> : <Badge tone="muted">Not verified</Badge>}
              </div>
              <p className="mt-1 text-[0.8rem] text-muted">
                {r.author_name} · {formatDateTime(r.created_at)} ·{" "}
                {r.products ? (
                  <Link href={`/products/${r.products.slug}`} className="text-forest underline" target="_blank">
                    {r.products.title}
                  </Link>
                ) : null}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-[0.92rem] leading-relaxed">{r.body}</p>
              <ReviewModeration id={r.id} status={r.status as "pending" | "approved" | "rejected" | "spam"} reply={r.admin_reply ?? ""} />
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} pages={Math.ceil((count ?? 0) / PAGE_SIZE)} makeHref={(p) => `/admin/reviews?status=${status}&page=${p}`} />
    </div>
  );
}

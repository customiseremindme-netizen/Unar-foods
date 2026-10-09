import { getStaffAccess } from "@/lib/auth/session";
import { getUserDb } from "@/lib/db/client";
import { csvResponse, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

/** CSV export of newsletter subscribers (for importing into an email tool). */
export async function GET(request: Request) {
  const access = await getStaffAccess();
  if (!access?.permissions.has("marketing.write")) return new Response("Forbidden", { status: 403 });
  const status = new URL(request.url).searchParams.get("status") ?? "subscribed";
  const db = (await getUserDb())!;
  let query = db.from("subscribers").select("email, status, consent_at, consent_text, source, unsubscribed_at").order("consent_at").limit(50000);
  if (status === "subscribed" || status === "unsubscribed") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return new Response("Export failed", { status: 500 });
  const csv = toCsv(
    ["Email", "Status", "Consent given at", "Consent wording", "Source", "Unsubscribed at"],
    (data ?? []).map((s) => [s.email, s.status, s.consent_at, s.consent_text, s.source, s.unsubscribed_at]),
  );
  return csvResponse(`unar-subscribers-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

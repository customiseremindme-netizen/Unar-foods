import { getStaffAccess } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { csvResponse, rupees, toCsv } from "@/lib/csv";
import { resolveRange } from "@/lib/admin/date-range";
import { REPORT_TABS, loadReport, type ReportType } from "@/lib/admin/reports";

export const dynamic = "force-dynamic";

/** CSV download of any report on the Reports page (amounts in rupees). */
export async function GET(request: Request) {
  const access = await getStaffAccess();
  if (!access?.permissions.has("reports.view")) return new Response("Forbidden", { status: 403 });
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const type = (REPORT_TABS.find((t) => t.key === params.type)?.key ?? "daily") as ReportType;
  const range = resolveRange(params);
  const supabase = (await createSupabaseServerClient())!;
  const report = await loadReport(supabase, type, range);
  const rows = report.rows.map((r) => r.map((v, i) => (report.money.includes(i) && v !== null ? rupees(Number(v)) : v)));
  return csvResponse(`unar-${type}-${range.fromStr}-to-${range.toStr}.csv`, toCsv(report.headers, rows));
}

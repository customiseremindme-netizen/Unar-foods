import Link from "next/link";
import { Download } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/admin/date-range";
import { REPORT_TABS, loadReport, type ReportType } from "@/lib/admin/reports";
import { getSetting } from "@/lib/settings";
import { formatINR } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Notice, PageHeader, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { RangeFilter } from "@/components/admin/range-filter";
import { RevenueChart, type DailyPoint } from "@/components/admin/revenue-chart";
import { EmptyState } from "@/components/ui/misc";

export const metadata = { title: "Reports" };

type Summary = { paid_orders: number; gross_revenue_paise: number; refunds_paise: number; discounts_paise: number; shipping_collected_paise: number; new_customers: number };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaffPage("reports.view");
  const params = await searchParams;
  const range = resolveRange(params);
  const tab = (REPORT_TABS.find((t) => t.key === params.tab)?.key ?? "daily") as ReportType;
  const supabase = (await createSupabaseServerClient())!;
  const [summaryRes, report, tax] = await Promise.all([
    supabase.rpc("report_summary", { p_from: range.from.toISOString(), p_to: range.to.toISOString() }),
    loadReport(supabase, tab, range),
    getSetting("tax"),
  ]);
  const s = summaryRes.data as Summary | null;
  const rangeQs: Record<string, string> = range.key === "custom" ? { range: "custom", from: range.fromStr, to: range.toStr } : { range: range.key };
  const exportHref = `/admin/export/report?${new URLSearchParams({ type: tab, ...rangeQs }).toString()}`;

  const fmt = (value: string | number | null, col: number) => {
    if (value === null) return "—";
    if (report.money.includes(col)) return formatINR(Number(value));
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(`${value}T00:00:00+05:30`);
    return value;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Figures come only from real, paid orders (COD counts once you mark the cash as collected). Dates use India time."
        actions={
          <a href={exportHref} className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-[0.85rem] font-semibold text-forest hover:border-forest">
            <Download className="size-4" aria-hidden="true" /> Download CSV
          </a>
        }
      />
      <RangeFilter basePath="/admin/reports" range={range} extra={{ tab }} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Revenue" value={formatINR(s?.gross_revenue_paise ?? 0)} hint={`${s?.paid_orders ?? 0} paid orders`} />
        <StatCard label="Refunds" value={formatINR(s?.refunds_paise ?? 0)} hint={`Net ${formatINR((s?.gross_revenue_paise ?? 0) - (s?.refunds_paise ?? 0))}`} />
        <StatCard label="Average order" value={s && s.paid_orders ? formatINR(Math.round(s.gross_revenue_paise / s.paid_orders)) : "—"} />
        <StatCard label="Discounts given" value={formatINR(s?.discounts_paise ?? 0)} />
        <StatCard label="Shipping charged" value={formatINR(s?.shipping_collected_paise ?? 0)} />
      </div>
      <nav aria-label="Report type" className="flex flex-wrap gap-2 text-[0.82rem]">
        {REPORT_TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/reports?${new URLSearchParams({ ...rangeQs, tab: t.key }).toString()}`}
            aria-current={tab === t.key ? "page" : undefined}
            className="rounded-full border border-line bg-paper px-3 py-1.5 hover:border-forest aria-[current=page]:border-forest aria-[current=page]:bg-forest aria-[current=page]:text-cream"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "tax" && !tax.gst_registered ? (
        <Notice>GST is switched off in Settings → Tax, so no GST has been charged. This report lists paid orders for your records.</Notice>
      ) : null}
      {tab === "daily" ? (
        <RevenueChart
          data={report.rows.map((r) => ({ day: String(r[0]), orders: Number(r[1]), revenue_paise: Number(r[2]), refunds_paise: Number(r[3]) }) satisfies DailyPoint)}
        />
      ) : null}
      {report.rows.length === 0 ? (
        <EmptyState title="Nothing in this period" description="Try a longer date range." />
      ) : (
        <Table>
          <thead>
            <tr>
              {report.headers.map((h, i) => (
                <Th key={h} className={report.money.includes(i) || typeof report.rows[0][i] === "number" ? "text-right" : undefined}>
                  {h}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(tab === "daily" ? [...report.rows].reverse() : report.rows).slice(0, 500).map((r, i) => (
              <tr key={i}>
                {r.map((v, c) => (
                  <Td key={c} className={typeof v === "number" ? "text-right tabular-nums" : undefined}>
                    {fmt(v, c)}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {report.rows.length > 500 ? <p className="text-[0.8rem] text-muted">Showing the first 500 rows. Download the CSV for everything.</p> : null}
    </div>
  );
}

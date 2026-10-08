"use client";

import { useState } from "react";
import { formatINR } from "@/lib/money";

export type DailyPoint = { day: string; revenue_paise: number; orders: number; refunds_paise: number };

function niceMax(value: number) {
  if (value <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * exp;
}

const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Paid revenue per day (single series → no legend; the card title names it).
 * Thin bars with rounded tops, recessive gridlines, per-bar hover/focus
 * tooltip, and a table view for screen readers and exact values.
 */
export function RevenueChart({ data }: { data: DailyPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const maxRupees = niceMax(Math.max(...data.map((d) => d.revenue_paise), 0) / 100);
  const max = maxRupees * 100;
  const ticks = [maxRupees, maxRupees / 2, 0];
  const total = data.reduce((s, d) => s + d.revenue_paise, 0);

  if (data.length === 0) return <p className="text-[0.88rem] text-muted">No data for this period.</p>;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[0.82rem] text-muted">
          {formatINR(total)} paid revenue · {data.reduce((s, d) => s + d.orders, 0)} paid orders
        </p>
        <button type="button" onClick={() => setShowTable((s) => !s)} className="text-[0.8rem] font-semibold text-forest underline underline-offset-4">
          {showTable ? "Show chart" : "Show as table"}
        </button>
      </div>
      {showTable ? (
        <div className="max-h-80 overflow-auto rounded-xl border border-line">
          <table className="w-full text-[0.82rem]">
            <thead className="sticky top-0 bg-cream">
              <tr className="text-left text-muted">
                <th className="px-3 py-2 font-semibold">Day</th>
                <th className="px-3 py-2 text-right font-semibold">Paid revenue</th>
                <th className="px-3 py-2 text-right font-semibold">Paid orders</th>
                <th className="px-3 py-2 text-right font-semibold">Refunds</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.day} className="border-t border-line/70">
                  <td className="px-3 py-1.5">{dayFmt.format(new Date(`${d.day}T00:00:00Z`))}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatINR(d.revenue_paise)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.orders}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatINR(d.refunds_paise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative pl-14" role="group" aria-label="Paid revenue per day">
          <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex flex-col justify-between pb-6" aria-hidden="true">
            {ticks.map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span className="w-12 text-right text-[0.7rem] tabular-nums text-muted">{formatINR(t * 100)}</span>
                <span className="h-px flex-1 bg-line/80" />
              </div>
            ))}
          </div>
          <div className="relative flex h-56 items-end gap-[2px] pb-6">
            {data.map((d, i) => {
              const h = max > 0 ? (d.revenue_paise / max) * 100 : 0;
              const label = `${dayFmt.format(new Date(`${d.day}T00:00:00Z`))}: ${formatINR(d.revenue_paise)} from ${d.orders} paid order${d.orders === 1 ? "" : "s"}`;
              return (
                <button
                  key={d.day}
                  type="button"
                  aria-label={label}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center focus:outline-none"
                >
                  <span
                    className="block w-full max-w-6 rounded-t-[4px] bg-olive transition-colors group-hover:bg-forest group-focus-visible:bg-forest"
                    style={{ height: `${Math.max(h, d.revenue_paise > 0 ? 1.5 : 0)}%` }}
                  />
                  {active === i ? (
                    <span className="pointer-events-none absolute bottom-[calc(100%+4px)] z-10 w-max max-w-48 -translate-x-0 rounded-lg bg-graphite px-2.5 py-1.5 text-left text-[0.72rem] leading-snug text-cream shadow-lift">
                      {label}
                      {d.refunds_paise > 0 ? <span className="block">Refunds {formatINR(d.refunds_paise)}</span> : null}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="absolute bottom-0 left-14 right-0 flex justify-between text-[0.7rem] text-muted" aria-hidden="true">
            <span>{dayFmt.format(new Date(`${data[0].day}T00:00:00Z`))}</span>
            {data.length > 2 ? <span>{dayFmt.format(new Date(`${data[Math.floor(data.length / 2)].day}T00:00:00Z`))}</span> : null}
            <span>{dayFmt.format(new Date(`${data[data.length - 1].day}T00:00:00Z`))}</span>
          </div>
        </div>
      )}
    </div>
  );
}

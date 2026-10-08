import Link from "next/link";
import { RANGE_PRESETS, type DateRange } from "@/lib/admin/date-range";
import { cn } from "@/lib/utils";
import { smallInput } from "./ui";

/** Date range presets + custom range (plain links/GET form — works without JavaScript). */
export function RangeFilter({ basePath, range, extra = {} }: { basePath: string; range: DateRange; extra?: Record<string, string> }) {
  const qs = (p: Record<string, string>) => new URLSearchParams({ ...extra, ...p }).toString();
  return (
    <div className="flex flex-wrap items-end gap-2">
      {RANGE_PRESETS.map((p) => (
        <Link
          key={p.key}
          href={`${basePath}?${qs({ range: p.key })}`}
          aria-current={range.key === p.key ? "page" : undefined}
          className={cn(
            "rounded-full border px-3 py-1.5 text-[0.8rem]",
            range.key === p.key ? "border-forest bg-forest text-cream" : "border-line bg-paper hover:border-forest",
          )}
        >
          {p.label}
        </Link>
      ))}
      <form action={basePath} className="flex flex-wrap items-end gap-2">
        {Object.entries(extra).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="range" value="custom" />
        <label className="text-[0.75rem] text-muted">
          From
          <input type="date" name="from" defaultValue={range.fromStr} className={cn(smallInput, "ml-1 h-9")} />
        </label>
        <label className="text-[0.75rem] text-muted">
          To
          <input type="date" name="to" defaultValue={range.toStr} className={cn(smallInput, "ml-1 h-9")} />
        </label>
        <button className="h-9 rounded-full border border-line bg-paper px-3 text-[0.8rem] hover:border-forest">Apply</button>
      </form>
    </div>
  );
}

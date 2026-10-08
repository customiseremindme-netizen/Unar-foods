/**
 * Date ranges for dashboard filters, in India Standard Time (UTC+5:30).
 * `from` is inclusive, `to` is exclusive.
 */
const IST_OFFSET_MIN = 330;

function istMidnight(dateStr: string): Date {
  // dateStr: YYYY-MM-DD interpreted as IST midnight
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MIN * 60 * 1000);
}

export function todayIST(): string {
  return new Date(Date.now() + IST_OFFSET_MIN * 60 * 1000).toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const RANGE_PRESETS = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "365d", label: "Last 12 months", days: 365 },
] as const;

export type DateRange = { from: Date; to: Date; fromStr: string; toStr: string; label: string; key: string };

export function resolveRange(params: { range?: string; from?: string; to?: string }): DateRange {
  const today = todayIST();
  const valid = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (params.range === "custom" && valid(params.from) && valid(params.to) && params.from! <= params.to!) {
    const span = (istMidnight(params.to!).getTime() - istMidnight(params.from!).getTime()) / 86400000;
    if (span <= 731) {
      return {
        from: istMidnight(params.from!),
        to: istMidnight(addDays(params.to!, 1)),
        fromStr: params.from!,
        toStr: params.to!,
        label: `${params.from} to ${params.to}`,
        key: "custom",
      };
    }
  }
  const preset = RANGE_PRESETS.find((p) => p.key === params.range) ?? RANGE_PRESETS[1];
  const fromStr = addDays(today, -(preset.days - 1));
  return { from: istMidnight(fromStr), to: istMidnight(addDays(today, 1)), fromStr, toStr: today, label: preset.label, key: preset.key };
}

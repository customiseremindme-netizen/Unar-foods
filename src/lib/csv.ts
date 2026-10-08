/**
 * CSV helpers. Cells that start with = + - @ are prefixed with ' so that
 * spreadsheet apps never execute them as formulas (CSV injection).
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n");
}

export function csvResponse(filename: string, csv: string): Response {
  // BOM so Excel opens UTF-8 (₹, names) correctly.
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function rupees(paise: number | null | undefined): string {
  return ((paise ?? 0) / 100).toFixed(2);
}

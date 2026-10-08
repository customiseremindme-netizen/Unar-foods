import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { DateRange } from "./date-range";
import type { TaxBreakdown } from "@/lib/commerce/types";

const PAID = ["paid", "partially_refunded", "refunded", "cod_collected"];

export type ReportType = "daily" | "products" | "coupons" | "tax" | "refunds";
export const REPORT_TABS: { key: ReportType; label: string }[] = [
  { key: "daily", label: "Sales by day" },
  { key: "products", label: "Products" },
  { key: "coupons", label: "Coupons" },
  { key: "tax", label: "GST" },
  { key: "refunds", label: "Refunds" },
];

/** Builds a report as plain rows (used by both the page and the CSV export). */
export async function loadReport(supabase: ServerSupabase, type: ReportType, range: DateRange): Promise<{ headers: string[]; rows: (string | number | null)[][]; money: number[] }> {
  const args = { p_from: range.from.toISOString(), p_to: range.to.toISOString() };
  switch (type) {
    case "daily": {
      const { data } = await supabase.rpc("report_daily_sales", args);
      return {
        headers: ["Day", "Paid orders", "Revenue", "Refunds", "Net"],
        rows: (data ?? []).map((d) => [d.day, Number(d.orders), Number(d.revenue_paise), Number(d.refunds_paise), Number(d.revenue_paise) - Number(d.refunds_paise)]),
        money: [2, 3, 4],
      };
    }
    case "products": {
      const { data } = await supabase.rpc("report_product_sales", args);
      return {
        headers: ["Product", "SKU", "Units sold", "Revenue (before order discounts)"],
        rows: (data ?? []).map((d) => [d.title, d.sku, Number(d.units), Number(d.revenue_paise)]),
        money: [3],
      };
    }
    case "coupons": {
      const { data } = await supabase.rpc("report_coupon_usage", args);
      return {
        headers: ["Code", "Paid orders", "Discount given", "Order revenue"],
        rows: (data ?? []).map((d) => [d.code, Number(d.uses), Number(d.discount_paise), Number(d.revenue_paise)]),
        money: [2, 3],
      };
    }
    case "tax": {
      const { data } = await supabase
        .from("orders")
        .select("order_number, paid_at, shipping_address, total_paise, tax_paise, tax_breakdown")
        .in("payment_status", PAID)
        .gte("paid_at", args.p_from)
        .lt("paid_at", args.p_to)
        .order("paid_at")
        .limit(20000);
      return {
        headers: ["Order", "Paid at", "Customer state", "Invoice total", "Taxable value", "CGST", "SGST", "IGST", "Total GST"],
        rows: (data ?? []).map((o) => {
          const b = (o.tax_breakdown ?? {}) as Partial<TaxBreakdown>;
          const state = (o.shipping_address as { state?: string } | null)?.state ?? "";
          return [o.order_number, o.paid_at, state, o.total_paise, b.configured ? (b.taxable_paise ?? 0) : null, b.cgst_paise ?? 0, b.sgst_paise ?? 0, b.igst_paise ?? 0, o.tax_paise];
        }),
        money: [3, 4, 5, 6, 7, 8],
      };
    }
    case "refunds": {
      const { data } = await supabase
        .from("refunds")
        .select("created_at, amount_paise, status, provider, reason, restocked, orders(order_number)")
        .gte("created_at", args.p_from)
        .lt("created_at", args.p_to)
        .order("created_at")
        .limit(20000);
      return {
        headers: ["Date", "Order", "Amount", "Status", "Method", "Reason", "Restocked"],
        rows: (data ?? []).map((r) => [r.created_at, r.orders?.order_number ?? "", r.amount_paise, r.status, r.provider, r.reason, r.restocked ? "yes" : "no"]),
        money: [2],
      };
    }
  }
}

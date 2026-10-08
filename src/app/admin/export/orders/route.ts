import { getStaffAccess } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { csvResponse, rupees, toCsv } from "@/lib/csv";
import { resolveRange } from "@/lib/admin/date-range";

export const dynamic = "force-dynamic";

/** CSV export of orders (respects the same filters as the Orders page). */
export async function GET(request: Request) {
  const access = await getStaffAccess();
  if (!access?.permissions.has("orders.read")) return new Response("Forbidden", { status: 403 });
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const supabase = (await createSupabaseServerClient())!;
  let query = supabase
    .from("orders")
    .select("order_number, created_at, paid_at, status, payment_status, fulfillment_status, payment_method, customer_name, email, phone, shipping_address, subtotal_paise, discount_paise, coupon_code, shipping_paise, cod_fee_paise, tax_paise, total_paise, refunded_paise, order_items(sku, quantity)")
    .order("created_at", { ascending: false })
    .limit(10000);
  if (params.status) query = query.eq("status", params.status);
  if (params.payment) query = query.eq("payment_status", params.payment);
  if (params.fulfillment) query = query.eq("fulfillment_status", params.fulfillment);
  if (params.from && params.to) {
    const range = resolveRange({ range: "custom", from: params.from, to: params.to });
    query = query.gte("created_at", range.from.toISOString()).lt("created_at", range.to.toISOString());
  }
  const { data, error } = await query;
  if (error) return new Response("Export failed", { status: 500 });
  const csv = toCsv(
    ["Order", "Created", "Paid", "Status", "Payment status", "Fulfilment", "Method", "Customer", "Email", "Phone", "City", "State", "PIN", "Items", "Subtotal", "Discount", "Coupon", "Shipping", "COD fee", "Tax", "Total", "Refunded"],
    (data ?? []).map((o) => {
      const a = o.shipping_address as Record<string, string>;
      return [
        o.order_number, o.created_at, o.paid_at, o.status, o.payment_status, o.fulfillment_status, o.payment_method,
        o.customer_name, o.email, o.phone, a.city, a.state, a.pincode,
        (o.order_items ?? []).map((i) => `${i.sku} x${i.quantity}`).join("; "),
        rupees(o.subtotal_paise), rupees(o.discount_paise), o.coupon_code, rupees(o.shipping_paise), rupees(o.cod_fee_paise),
        rupees(o.tax_paise), rupees(o.total_paise), rupees(o.refunded_paise),
      ];
    }),
  );
  return csvResponse(`unar-orders-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

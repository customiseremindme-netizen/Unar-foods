import { getStaffAccess } from "@/lib/auth/session";
import { getUserDb } from "@/lib/db/client";
import { csvResponse, rupees, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

/** CSV export of customers (same search as the Customers page). */
export async function GET(request: Request) {
  const access = await getStaffAccess();
  if (!access?.permissions.has("customers.read")) return new Response("Forbidden", { status: 403 });
  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 80);
  const db = (await getUserDb())!;
  const rows: unknown[][] = [];
  for (let offset = 0; offset < 20000; offset += 200) {
    const { data, error } = await db.rpc("admin_customers", { p_search: q, p_limit: 200, p_offset: offset });
    if (error) return new Response("Export failed", { status: 500 });
    for (const c of data ?? []) {
      rows.push([c.full_name, c.email, c.phone, c.is_registered ? "account" : "guest", c.orders_count, c.paid_orders, rupees(Number(c.total_spent_paise)), c.last_order_at, c.created_at, c.marketing_consent ? "yes" : "no"]);
    }
    if (!data || data.length < 200) break;
  }
  const csv = toCsv(["Name", "Email", "Phone", "Type", "Orders", "Paid orders", "Total spent (₹)", "Last order", "First seen", "Marketing consent"], rows);
  return csvResponse(`unar-customers-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

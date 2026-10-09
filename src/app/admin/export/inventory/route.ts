import { getStaffAccess } from "@/lib/auth/session";
import { getUserDb } from "@/lib/db/client";
import { csvResponse, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

/** CSV export of current stock levels. */
export async function GET() {
  const access = await getStaffAccess();
  if (!access?.permissions.has("inventory.read")) return new Response("Forbidden", { status: 403 });
  const db = (await getUserDb())!;
  const { data, error } = await db
    .from("product_variants")
    .select("sku, title, barcode, stock, low_stock_threshold, is_active, is_demo_stock, products(title, status)")
    .order("sku");
  if (error) return new Response("Export failed", { status: 500 });
  const csv = toCsv(
    ["SKU", "Product", "Size", "Barcode", "Stock", "Low stock alert", "Available", "Demo stock", "Product status"],
    (data ?? []).map((v) => [v.sku, v.products?.title, v.title, v.barcode, v.stock, v.low_stock_threshold, v.is_active ? "yes" : "no", v.is_demo_stock ? "yes" : "no", v.products?.status]),
  );
  return csvResponse(`unar-inventory-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

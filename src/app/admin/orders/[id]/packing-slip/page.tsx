import Image from "next/image";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicSettings } from "@/lib/settings";
import { formatDate } from "@/lib/utils";
import { PrintButton } from "@/components/orders/print-button";

export const metadata = { title: "Packing slip" };

export default async function PackingSlipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage("orders.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = (await createSupabaseServerClient())!;
  const { data: order } = await supabase
    .from("orders")
    .select("order_number, created_at, customer_name, phone, shipping_address, payment_method, payment_status, total_paise, customer_note, order_items(title, variant_title, sku, quantity)")
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();
  const { store, brand } = await getPublicSettings();
  const a = order.shipping_address as Record<string, string>;
  return (
    <div className="bg-white p-6 text-[0.95rem] text-graphite print:p-0">
      <div className="no-print mb-6 flex justify-end">
        <PrintButton label="Print packing slip" />
      </div>
      <div className="mx-auto max-w-2xl">
        <div className="flex items-start justify-between border-b border-graphite/30 pb-4">
          <div className="w-40">
            <Image src={brand.logo_url} alt={brand.logo_alt} width={brand.logo_width} height={brand.logo_height} className="h-auto w-full" />
          </div>
          <div className="text-right">
            <h1 className="font-display text-[1.6rem] text-forest">Packing slip</h1>
            <p>
              <strong>{order.order_number}</strong> · {formatDate(order.created_at)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6 py-5">
          <div>
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em]">Ship to</p>
            <p className="mt-1 text-[1.05rem] font-semibold">{a.full_name}</p>
            <p>{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
            {a.landmark ? <p>Landmark: {a.landmark}</p> : null}
            <p>{a.city}, {a.state} — {a.pincode}</p>
            <p>Phone: {a.phone || order.phone}</p>
          </div>
          <div>
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em]">From</p>
            <p className="mt-1 font-semibold">{store.name}</p>
            {store.address_lines.map((l) => <p key={l}>{l}</p>)}
            {store.phone ? <p>Phone: {store.phone}</p> : null}
          </div>
        </div>
        {order.payment_method === "cod" && order.payment_status === "cod_pending" ? (
          <p className="mb-4 rounded border-2 border-graphite p-3 text-center text-[1.1rem] font-bold">
            CASH ON DELIVERY — COLLECT ₹{(order.total_paise / 100).toFixed(2)}
          </p>
        ) : (
          <p className="mb-4 text-[0.85rem]">Prepaid order — do not collect payment.</p>
        )}
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-graphite/40 text-left text-[0.75rem] uppercase tracking-[0.1em]">
              <th className="py-2">Item</th>
              <th className="py-2">SKU</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Packed</th>
            </tr>
          </thead>
          <tbody>
            {(order.order_items ?? []).map((i, idx) => (
              <tr key={idx} className="border-b border-line">
                <td className="py-2.5">{i.title}{i.variant_title ? ` (${i.variant_title})` : ""}</td>
                <td className="py-2.5">{i.sku}</td>
                <td className="py-2.5 text-right text-[1.1rem] font-bold">{i.quantity}</td>
                <td className="py-2.5 text-right">☐</td>
              </tr>
            ))}
          </tbody>
        </table>
        {order.customer_note ? <p className="mt-4"><strong>Customer note:</strong> {order.customer_note}</p> : null}
      </div>
    </div>
  );
}

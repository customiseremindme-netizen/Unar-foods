import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getOrderForViewer } from "@/lib/orders/view";
import { getAllSettings } from "@/lib/settings";
import { formatINRFixed } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { PrintButton } from "@/components/orders/print-button";
import type { TaxBreakdown } from "@/lib/commerce/types";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Printable invoice / receipt. Use the browser's "Save as PDF" to download.
 * Tax details come only from owner-entered settings and the amounts recorded
 * on the order — nothing is estimated here.
 */
export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ orderNumber }, { token }] = await Promise.all([params, searchParams]);
  const order = await getOrderForViewer(decodeURIComponent(orderNumber), token ?? null, { allowStaff: true });
  if (!order) notFound();
  const paid = ["paid", "partially_refunded", "refunded", "cod_collected"].includes(order.payment_status);
  if (!paid) notFound();

  const settings = await getAllSettings();
  const { store, tax, brand } = settings;
  const breakdown = order.tax_breakdown as TaxBreakdown;
  const taxConfigured = !!breakdown?.configured;
  const isTaxInvoice = tax.gst_registered && !!tax.gstin && taxConfigured;
  const billing = order.billing_address ?? order.shipping_address;
  const ship = order.shipping_address;

  return (
    <div className="min-h-dvh bg-cream-deep/40 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-end gap-3 px-4">
        <PrintButton />
      </div>
      <main className="mx-auto max-w-3xl bg-white p-8 text-[0.85rem] leading-relaxed text-graphite shadow-soft print:max-w-none print:p-0 print:shadow-none sm:p-12">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <div className="w-44">
            <Image src={brand.logo_url} alt={brand.logo_alt} width={brand.logo_width} height={brand.logo_height} className="h-auto w-full" priority />
          </div>
          <div className="text-right">
            <h1 className="font-display text-[1.8rem] text-forest">{isTaxInvoice ? "Tax Invoice" : "Invoice"}</h1>
            <p>
              No. <strong>{order.order_number}</strong>
            </p>
            <p>Date: {formatDate(order.paid_at ?? order.placed_at ?? order.created_at)}</p>
          </div>
        </header>

        <section className="grid gap-6 border-b border-line py-6 sm:grid-cols-3">
          <div>
            <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-olive-ink">Sold by</p>
            <p className="font-semibold">{tax.legal_name || store.legal_name || store.name}</p>
            {store.address_lines.map((l) => (
              <p key={l}>{l}</p>
            ))}
            {store.email ? <p>{store.email}</p> : null}
            {store.phone ? <p>+91 {store.phone}</p> : null}
            {tax.gst_registered && tax.gstin ? <p>GSTIN: {tax.gstin}</p> : null}
            {store.fssai_license ? <p>FSSAI Lic. No.: {store.fssai_license}</p> : null}
          </div>
          <div>
            <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-olive-ink">Bill to</p>
            <p className="font-semibold">{billing.full_name}</p>
            <p>
              {billing.line1}
              {billing.line2 ? `, ${billing.line2}` : ""}
            </p>
            <p>
              {billing.city}, {billing.state} {billing.pincode}
            </p>
            <p>{order.email}</p>
            <p>{order.phone}</p>
          </div>
          <div>
            <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-olive-ink">Ship to</p>
            <p className="font-semibold">{ship.full_name}</p>
            <p>
              {ship.line1}
              {ship.line2 ? `, ${ship.line2}` : ""}
            </p>
            <p>
              {ship.city}, {ship.state} {ship.pincode}
            </p>
            {isTaxInvoice ? <p>Place of supply: {ship.state}</p> : null}
          </div>
        </section>

        <table className="mt-6 w-full border-collapse">
          <thead>
            <tr className="border-b border-graphite/30 text-left text-[0.72rem] uppercase tracking-[0.1em]">
              <th className="py-2">Item</th>
              {isTaxInvoice ? <th className="py-2">HSN</th> : null}
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit price</th>
              {isTaxInvoice ? <th className="py-2 text-right">GST %</th> : null}
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-line">
                <td className="py-2.5">
                  {item.title}
                  {item.variant_title ? <span className="text-muted"> ({item.variant_title})</span> : null}
                  {item.sku ? <span className="block text-[0.72rem] text-muted">SKU {item.sku}</span> : null}
                </td>
                {isTaxInvoice ? <td className="py-2.5">{item.hsn_code ?? "—"}</td> : null}
                <td className="py-2.5 text-right">{item.quantity}</td>
                <td className="py-2.5 text-right tabular-nums">{formatINRFixed(item.unit_price_paise)}</td>
                {isTaxInvoice ? <td className="py-2.5 text-right">{item.gst_rate ?? "—"}</td> : null}
                <td className="py-2.5 text-right tabular-nums">{formatINRFixed(item.line_total_paise)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatINRFixed(order.subtotal_paise)}</dd>
            </div>
            {order.discount_paise > 0 ? (
              <div className="flex justify-between">
                <dt>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</dt>
                <dd className="tabular-nums">−{formatINRFixed(order.discount_paise)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt>Shipping</dt>
              <dd className="tabular-nums">{formatINRFixed(order.shipping_paise)}</dd>
            </div>
            {order.cod_fee_paise > 0 ? (
              <div className="flex justify-between">
                <dt>COD fee</dt>
                <dd className="tabular-nums">{formatINRFixed(order.cod_fee_paise)}</dd>
              </div>
            ) : null}
            {isTaxInvoice && !order.prices_include_tax ? (
              <div className="flex justify-between">
                <dt>GST</dt>
                <dd className="tabular-nums">{formatINRFixed(order.tax_paise)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-graphite/30 pt-2 text-[1rem] font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatINRFixed(order.total_paise)}</dd>
            </div>
            {order.refunded_paise > 0 ? (
              <div className="flex justify-between text-muted">
                <dt>Refunded</dt>
                <dd className="tabular-nums">−{formatINRFixed(order.refunded_paise)}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {isTaxInvoice ? (
          <section className="mt-6 rounded-lg bg-cream/60 p-4 text-[0.8rem]">
            <p className="font-semibold">Tax summary ({breakdown.mode === "inclusive" ? "included in prices" : "added to prices"})</p>
            <p>Taxable value: {formatINRFixed(breakdown.taxable_paise)}</p>
            {breakdown.intra_state ? (
              <p>
                CGST: {formatINRFixed(breakdown.cgst_paise)} · SGST: {formatINRFixed(breakdown.sgst_paise)}
              </p>
            ) : (
              <p>IGST: {formatINRFixed(breakdown.igst_paise)}</p>
            )}
          </section>
        ) : (
          <p className="mt-6 text-[0.78rem] text-muted">
            {order.prices_include_tax ? "Prices are inclusive of all applicable taxes." : ""}
          </p>
        )}

        <footer className="mt-10 border-t border-line pt-6 text-[0.78rem] text-muted">
          <p>
            Payment: {order.payment_method === "cod" ? "Cash on Delivery" : "Online (Razorpay)"} · Status: {order.payment_status.replace(/_/g, " ")}
          </p>
          {tax.invoice_footer ? <p className="mt-2">{tax.invoice_footer}</p> : null}
          <p className="mt-2">This is a computer-generated document.</p>
        </footer>
      </main>
    </div>
  );
}

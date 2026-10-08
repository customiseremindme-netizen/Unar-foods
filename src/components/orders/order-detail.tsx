import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Clock, ExternalLink, FileText, Package, Truck } from "lucide-react";
import type { OrderView } from "@/lib/orders/view";
import { orderStatusLabel } from "@/lib/orders/view";
import { formatINR } from "@/lib/money";
import { formatDate, formatDateTime, titleCase } from "@/lib/utils";
import { Badge } from "@/components/ui/misc";
import { RetryPayment } from "./retry-payment";

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: "Awaiting payment",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partly refunded",
  cod_pending: "Pay on delivery",
  cod_collected: "Paid on delivery",
};

function Address({ a }: { a: Record<string, string> }) {
  return (
    <address className="not-italic leading-relaxed text-muted">
      <span className="block font-semibold text-graphite">{a.full_name}</span>
      {a.line1}
      {a.line2 ? <>, {a.line2}</> : null}
      <br />
      {a.landmark ? (
        <>
          Landmark: {a.landmark}
          <br />
        </>
      ) : null}
      {a.city}, {a.state} {a.pincode}
      <br />
      {a.phone ? <>Phone: {a.phone}</> : null}
    </address>
  );
}

export function OrderDetail({ order, token, showRetry = true }: { order: OrderView; token: string | null; showRetry?: boolean }) {
  const status = orderStatusLabel(order);
  const paid = ["paid", "partially_refunded", "refunded", "cod_collected"].includes(order.payment_status);
  const invoiceHref = `/invoice/${order.order_number}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  const pendingStillValid =
    order.status === "pending_payment" && (!order.reservation_expires_at || new Date(order.reservation_expires_at) > new Date());

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={status.tone}>{status.label}</Badge>
        <span className="text-[0.85rem] text-muted">Placed {formatDateTime(order.placed_at ?? order.created_at)}</span>
      </div>

      {order.status === "pending_payment" ? (
        <div className="rounded-[1.5rem] border border-banana/40 bg-banana-soft/50 p-6">
          <p className="flex items-center gap-2 font-semibold text-forest-deep">
            <Clock className="size-4" aria-hidden="true" /> We haven&apos;t received payment for this order yet.
          </p>
          <p className="mt-1 text-[0.9rem] text-forest-deep/80">
            {pendingStillValid
              ? "If you've just paid, this page will update in a moment. Otherwise you can complete payment below."
              : "The payment window has closed. Please place a new order."}
          </p>
          {pendingStillValid && showRetry ? <RetryPayment orderNumber={order.order_number} token={token} /> : null}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="rounded-[1.75rem] border border-line bg-paper p-6 lg:col-span-2" aria-labelledby="items-heading">
          <h2 id="items-heading" className="font-sans text-[1rem] font-semibold tracking-normal">
            Items
          </h2>
          <ul className="mt-4 divide-y divide-line">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 py-4">
                <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-cream-deep">
                  {item.image_url ? <Image src={item.image_url} alt="" fill sizes="64px" className="object-cover" /> : null}
                </span>
                <span className="min-w-0 flex-1 text-[0.9rem]">
                  <span className="block font-semibold text-forest">{item.title}</span>
                  <span className="text-muted">
                    {item.variant_title} · {formatINR(item.unit_price_paise)} × {item.quantity}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{formatINR(item.line_total_paise)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[0.9rem]">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{formatINR(order.subtotal_paise)}</dd>
            </div>
            {order.discount_paise > 0 ? (
              <div className="flex justify-between text-success">
                <dt>Discount {order.coupon_code ? `(${order.coupon_code})` : ""}</dt>
                <dd className="tabular-nums">−{formatINR(order.discount_paise)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted">Shipping</dt>
              <dd className="tabular-nums">{order.shipping_paise === 0 ? "Free" : formatINR(order.shipping_paise)}</dd>
            </div>
            {order.cod_fee_paise > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted">Cash on Delivery fee</dt>
                <dd className="tabular-nums">{formatINR(order.cod_fee_paise)}</dd>
              </div>
            ) : null}
            {order.tax_paise > 0 && !order.prices_include_tax ? (
              <div className="flex justify-between">
                <dt className="text-muted">GST</dt>
                <dd className="tabular-nums">{formatINR(order.tax_paise)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-line pt-3 text-[1.05rem] font-semibold text-forest">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatINR(order.total_paise)}</dd>
            </div>
            {order.refunded_paise > 0 ? (
              <div className="flex justify-between text-muted">
                <dt>Refunded</dt>
                <dd className="tabular-nums">{formatINR(order.refunded_paise)}</dd>
              </div>
            ) : null}
          </dl>
          {paid ? (
            <Link href={invoiceHref} className="mt-6 inline-flex items-center gap-2 text-[0.88rem] font-semibold text-forest underline underline-offset-4">
              <FileText className="size-4" aria-hidden="true" /> View / download invoice
            </Link>
          ) : null}
        </section>

        <div className="space-y-8">
          <section className="rounded-[1.75rem] border border-line bg-paper p-6 text-[0.9rem]" aria-labelledby="delivery-heading">
            <h2 id="delivery-heading" className="mb-3 font-sans text-[1rem] font-semibold tracking-normal">
              Delivery address
            </h2>
            <Address a={order.shipping_address} />
          </section>
          <section className="rounded-[1.75rem] border border-line bg-paper p-6 text-[0.9rem]" aria-labelledby="payment-heading">
            <h2 id="payment-heading" className="mb-3 font-sans text-[1rem] font-semibold tracking-normal">
              Payment
            </h2>
            <p className="text-muted">
              {order.payment_method === "cod" ? "Cash on Delivery" : "Online (Razorpay)"} · {PAYMENT_LABELS[order.payment_status] ?? titleCase(order.payment_status)}
            </p>
            {order.paid_at ? <p className="mt-1 text-muted">Paid {formatDate(order.paid_at)}</p> : null}
          </section>
        </div>
      </div>

      {order.shipments.length > 0 ? (
        <section aria-labelledby="tracking-heading" className="rounded-[1.75rem] border border-line bg-paper p-6">
          <h2 id="tracking-heading" className="flex items-center gap-2 font-sans text-[1rem] font-semibold tracking-normal">
            <Truck className="size-4 text-olive" aria-hidden="true" /> Shipment tracking
          </h2>
          {order.shipments.map((s) => (
            <div key={s.id} className="mt-4 rounded-2xl bg-cream/60 p-4 text-[0.9rem]">
              <p className="font-semibold text-forest">
                {s.carrier ?? "Courier"} {s.tracking_number ? `· ${s.tracking_number}` : ""} · {titleCase(s.status)}
              </p>
              {s.tracking_url ? (
                <a href={s.tracking_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-forest underline">
                  Track on courier website <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ) : null}
              {s.shipment_events.length > 0 ? (
                <ol className="mt-3 space-y-2 border-l border-sage pl-4">
                  {s.shipment_events.map((e) => (
                    <li key={e.id}>
                      <span className="font-medium">{titleCase(e.status)}</span>
                      {e.description ? <span className="text-muted"> — {e.description}</span> : null}
                      {e.location ? <span className="text-muted"> ({e.location})</span> : null}
                      <span className="block text-[0.78rem] text-muted">{formatDateTime(e.occurred_at)}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {order.events.length > 0 ? (
        <section aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="flex items-center gap-2 font-sans text-[1rem] font-semibold tracking-normal">
            <Package className="size-4 text-olive" aria-hidden="true" /> Order updates
          </h2>
          <ol className="mt-4 space-y-4 border-l border-line pl-5">
            {order.events.map((e) => (
              <li key={e.id} className="relative text-[0.9rem]">
                <CheckCircle2 className="absolute -left-[1.85rem] top-0.5 size-4 bg-cream text-olive" aria-hidden="true" />
                <p>{e.message}</p>
                <p className="text-[0.78rem] text-muted">{formatDateTime(e.created_at)}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

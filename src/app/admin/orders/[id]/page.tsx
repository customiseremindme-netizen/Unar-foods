import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileText, Printer, TriangleAlert } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isShiprocketConfigured } from "@/lib/shipping/shiprocket";
import { formatINR } from "@/lib/money";
import { formatDateTime, titleCase } from "@/lib/utils";
import { orderStatusLabel } from "@/lib/orders/view";
import { Card, Notice, PageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/misc";
import {
  CancelPanel,
  FulfillmentPanel,
  NewShipment,
  NotePanel,
  QuickActions,
  RefundPanel,
  ShipmentActions,
} from "@/components/admin/order-panels";

export const metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { access } = await requireStaffPage("orders.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = (await createSupabaseServerClient())!;
  const { data: order } = await supabase
    .from("orders")
    .select(
      `*, order_items(*), order_events(id, type, message, visibility, created_at, actor_id),
       payments(id, provider, provider_order_id, provider_payment_id, amount_paise, status, method, error_description, created_at),
       refunds(id, provider, provider_refund_id, amount_paise, status, reason, restocked, created_at),
       shipments(id, provider, carrier, tracking_number, tracking_url, status, awb_code, shipped_at, delivered_at, created_at,
         shipment_events(id, status, description, location, occurred_at, source)),
       notification_log(id, template, recipient, status, error, created_at)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const canWrite = access.permissions.has("orders.write");
  const canCancel = access.permissions.has("orders.cancel");
  const canRefund = access.permissions.has("orders.refund");
  const st = orderStatusLabel(order);
  const ship = order.shipping_address as Record<string, string>;
  const bill = (order.billing_address ?? order.shipping_address) as Record<string, string>;
  const paid = ["paid", "partially_refunded", "cod_collected"].includes(order.payment_status);
  const remaining = order.total_paise - order.refunded_paise;
  const events = [...(order.order_events ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const shiprocket = isShiprocketConfigured();

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/admin/orders", label: "All orders" }}
        title={`Order ${order.order_number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={st.tone}>{st.label}</Badge>
            <span>Placed {formatDateTime(order.placed_at ?? order.created_at)}</span>
          </span>
        }
        actions={
          <>
            <Link href={`/admin/orders/${order.id}/packing-slip`} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-[0.85rem] font-semibold text-forest hover:border-forest">
              <Printer className="size-4" aria-hidden="true" /> Packing slip
            </Link>
            {paid || order.payment_status === "refunded" ? (
              <Link href={`/invoice/${order.order_number}`} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-[0.85rem] font-semibold text-forest hover:border-forest">
                <FileText className="size-4" aria-hidden="true" /> Invoice
              </Link>
            ) : null}
          </>
        }
      />

      {order.needs_attention ? (
        <Notice tone="danger">
          <TriangleAlert className="mr-2 inline size-4" aria-hidden="true" />
          {order.attention_reason ?? "This order needs attention."}
        </Notice>
      ) : null}

      <QuickActions
        orderId={order.id}
        status={order.status}
        paymentStatus={order.payment_status}
        paymentMethod={order.payment_method}
        needsAttention={order.needs_attention}
        canWrite={canWrite}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Items">
            <ul className="divide-y divide-line">
              {(order.order_items ?? []).map((item) => (
                <li key={item.id} className="flex items-center gap-4 py-3">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-cream-deep">
                    {item.image_url ? <Image src={item.image_url} alt="" fill sizes="56px" className="object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 text-[0.88rem]">
                    <span className="block font-semibold text-forest">{item.title}</span>
                    <span className="text-muted">
                      {item.variant_title} · SKU {item.sku} · {formatINR(item.unit_price_paise)} × {item.quantity}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatINR(item.line_total_paise)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-[0.88rem]">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{formatINR(order.subtotal_paise)}</dd></div>
              {order.discount_paise > 0 ? (
                <div className="flex justify-between"><dt className="text-muted">Discount {order.coupon_code ? `(${order.coupon_code})` : ""}</dt><dd className="tabular-nums">−{formatINR(order.discount_paise)}</dd></div>
              ) : null}
              <div className="flex justify-between"><dt className="text-muted">Shipping {order.shipping_method ? `(${order.shipping_method})` : ""}</dt><dd className="tabular-nums">{formatINR(order.shipping_paise)}</dd></div>
              {order.cod_fee_paise > 0 ? <div className="flex justify-between"><dt className="text-muted">COD fee</dt><dd className="tabular-nums">{formatINR(order.cod_fee_paise)}</dd></div> : null}
              {order.tax_paise > 0 ? (
                <div className="flex justify-between"><dt className="text-muted">GST {order.prices_include_tax ? "(included)" : ""}</dt><dd className="tabular-nums">{formatINR(order.tax_paise)}</dd></div>
              ) : null}
              <div className="flex justify-between border-t border-line pt-2 font-semibold text-forest"><dt>Total</dt><dd className="tabular-nums">{formatINR(order.total_paise)}</dd></div>
              {order.refunded_paise > 0 ? <div className="flex justify-between text-danger"><dt>Refunded</dt><dd className="tabular-nums">−{formatINR(order.refunded_paise)}</dd></div> : null}
            </dl>
            {order.customer_note ? (
              <p className="mt-4 rounded-xl bg-banana-soft/50 p-3 text-[0.86rem]">
                <strong>Customer note:</strong> {order.customer_note}
              </p>
            ) : null}
          </Card>

          {order.status === "placed" ? (
            <Card title="Fulfilment" description={`Current status: ${titleCase(order.fulfillment_status)}`}>
              <FulfillmentPanel orderId={order.id} fulfillment={order.fulfillment_status} canWrite={canWrite} />
            </Card>
          ) : null}

          <Card title="Shipments & tracking">
            {(order.shipments ?? []).length === 0 ? <p className="mb-3 text-[0.86rem] text-muted">No shipments yet.</p> : null}
            <ul className="space-y-4">
              {(order.shipments ?? []).map((s) => (
                <li key={s.id} className="rounded-xl border border-line p-4 text-[0.86rem]">
                  <p className="font-semibold text-forest">
                    {s.carrier ?? "Courier"} {s.tracking_number ? `· ${s.tracking_number}` : ""} · {titleCase(s.status)}
                    {s.provider === "shiprocket" ? <Badge tone="sage" className="ml-2">Shiprocket</Badge> : null}
                  </p>
                  {s.tracking_url ? (
                    <a href={s.tracking_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-forest underline">
                      Tracking link <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  ) : null}
                  {(s.shipment_events ?? []).length > 0 ? (
                    <ol className="mt-2 space-y-1 border-l border-sage pl-3 text-[0.8rem] text-muted">
                      {[...s.shipment_events].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, 6).map((e) => (
                        <li key={e.id}>
                          {titleCase(e.status)} {e.description ? `— ${e.description}` : ""} {e.location ? `(${e.location})` : ""} · {formatDateTime(e.occurred_at)}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {canWrite ? <ShipmentActions shipment={s} orderId={order.id} shiprocket={shiprocket} /> : null}
                </li>
              ))}
            </ul>
            {canWrite && order.status === "placed" ? (
              <div className="mt-4">
                <NewShipment orderId={order.id} shiprocket={shiprocket} />
              </div>
            ) : null}
          </Card>

          <Card title="Timeline">
            {canWrite ? (
              <div className="mb-5">
                <NotePanel orderId={order.id} />
              </div>
            ) : null}
            <ol className="space-y-3 border-l border-line pl-4 text-[0.85rem]">
              {events.map((e) => (
                <li key={e.id}>
                  <p>
                    {e.message}{" "}
                    <Badge tone={e.visibility === "customer" ? "sage" : "muted"} className="ml-1">
                      {e.visibility === "customer" ? "Customer can see" : "Internal"}
                    </Badge>
                  </p>
                  <p className="text-[0.75rem] text-muted">{formatDateTime(e.created_at)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Customer">
            <p className="font-semibold text-forest">{order.customer_name}</p>
            <p className="text-[0.86rem]">
              <a href={`mailto:${order.email}`} className="underline">{order.email}</a>
            </p>
            <p className="text-[0.86rem]">
              <a href={`tel:+91${order.phone}`} className="underline">+91 {order.phone}</a>
            </p>
            <p className="mt-1 text-[0.78rem] text-muted">{order.user_id ? "Registered customer" : "Guest checkout"}</p>
            {access.permissions.has("customers.read") ? (
              <Link href={`/admin/customers/${encodeURIComponent(order.email.toLowerCase())}`} className="mt-2 inline-block text-[0.82rem] font-semibold text-forest underline">
                View customer
              </Link>
            ) : null}
            <div className="mt-4 grid gap-4 text-[0.85rem] sm:grid-cols-2 xl:grid-cols-1">
              <div>
                <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted">Ship to</p>
                <address className="not-italic leading-relaxed">
                  {ship.full_name}<br />
                  {ship.line1}{ship.line2 ? `, ${ship.line2}` : ""}<br />
                  {ship.landmark ? <>Landmark: {ship.landmark}<br /></> : null}
                  {ship.city}, {ship.state} {ship.pincode}<br />
                  Phone: {ship.phone}
                </address>
              </div>
              <div>
                <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted">Bill to</p>
                <address className="not-italic leading-relaxed">
                  {bill.full_name}<br />
                  {bill.line1}{bill.line2 ? `, ${bill.line2}` : ""}<br />
                  {bill.city}, {bill.state} {bill.pincode}
                </address>
              </div>
            </div>
          </Card>

          <Card title="Payment">
            <p className="text-[0.86rem]">
              {order.payment_method === "cod" ? "Cash on Delivery" : "Online (Razorpay)"} · <strong>{titleCase(order.payment_status)}</strong>
            </p>
            {order.paid_at ? <p className="text-[0.8rem] text-muted">Paid {formatDateTime(order.paid_at)}</p> : null}
            <ul className="mt-3 space-y-2 text-[0.8rem]">
              {(order.payments ?? []).map((p) => (
                <li key={p.id} className="rounded-lg bg-cream/60 p-2.5">
                  <span className="font-semibold">{formatINR(p.amount_paise)}</span> · {p.status}
                  {p.method ? ` · ${p.method}` : ""}
                  {p.provider_payment_id ? <span className="block break-all text-muted">{p.provider_payment_id}</span> : null}
                  {p.error_description ? <span className="block text-danger">{p.error_description}</span> : null}
                </li>
              ))}
            </ul>
            {(order.refunds ?? []).length > 0 ? (
              <div className="mt-4">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted">Refunds</p>
                <ul className="mt-2 space-y-2 text-[0.8rem]">
                  {order.refunds.map((r) => (
                    <li key={r.id} className="rounded-lg bg-danger-soft/50 p-2.5">
                      {formatINR(r.amount_paise)} · {r.status} · {r.provider}
                      {r.reason ? <span className="block text-muted">{r.reason}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          {canRefund && paid && remaining > 0 ? (
            <Card title="Refund">
              <RefundPanel orderId={order.id} remainingPaise={remaining} method={order.payment_method} />
            </Card>
          ) : null}

          {canCancel && (order.status === "placed" || order.status === "pending_payment") && !["shipped", "delivered", "returned"].includes(order.fulfillment_status) ? (
            <Card title="Cancel order">
              <CancelPanel orderId={order.id} paidOnline={order.payment_method === "razorpay" && paid} canRefund={canRefund} />
            </Card>
          ) : null}

          <Card title="Emails sent">
            {(order.notification_log ?? []).length === 0 ? (
              <p className="text-[0.82rem] text-muted">No emails recorded.</p>
            ) : (
              <ul className="space-y-1.5 text-[0.8rem]">
                {order.notification_log.map((n) => (
                  <li key={n.id}>
                    {titleCase(n.template)} → {n.status}
                    {n.error ? <span className="text-muted"> ({n.error})</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

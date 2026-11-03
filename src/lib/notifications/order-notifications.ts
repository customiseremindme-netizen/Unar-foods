import "server-only";
import { getServiceDb } from "@/lib/db/client";
import { getAllSettings } from "@/lib/settings";
import { getRequestSiteUrl } from "@/lib/site-url";
import { sendEmail } from "@/lib/email/send";
import { escapeHtml, fillTemplate, renderOrderEmail, type EmailOrder } from "@/lib/email/templates";
import { logError } from "@/lib/monitoring";
import { isInvoiceable, renderInvoicePdf, type InvoiceOrder } from "@/lib/invoices/pdf";
import type { EmailAttachment } from "@/lib/email/send";

export type OrderTemplate =
  | "order_placed"
  | "payment_confirmed"
  | "order_shipped"
  | "order_delivered"
  | "order_cancelled"
  | "refund_issued"
  | "invoice"
  | "admin_new_order";

/** Templates that should only ever be sent once per order. */
const ONCE_ONLY: OrderTemplate[] = ["order_placed", "payment_confirmed", "admin_new_order", "order_delivered", "order_cancelled", "invoice"];

/** Emails that carry the PDF invoice (when the order is paid and the owner hasn't switched it off). */
const WITH_INVOICE: OrderTemplate[] = ["payment_confirmed", "invoice"];

const HEADINGS: Record<OrderTemplate, string> = {
  order_placed: "Thank you for your order",
  payment_confirmed: "Your order is confirmed",
  order_shipped: "Your order is on its way",
  order_delivered: "Your order was delivered",
  order_cancelled: "Your order was cancelled",
  refund_issued: "Refund update",
  invoice: "Your invoice",
  admin_new_order: "New order received",
};

/**
 * Sends an order email (customer or admin) and records the result in the
 * notification log. Never throws — a failed email must not break checkout.
 */
export async function notifyOrder(
  orderId: string,
  template: OrderTemplate,
  extra?: { html?: string; text?: string; force?: boolean },
): Promise<void> {
  try {
    const admin = getServiceDb();
    if (!admin) return;
    const settings = await getAllSettings();
    const notifications = settings.notifications;

    if (template === "invoice" && !notifications.send_invoice && !extra?.force) return;
    if (ONCE_ONLY.includes(template) && !extra?.force) {
      const { count } = await admin
        .from("notification_log")
        .select("id", { count: "exact", head: true })
        .eq("order_id", orderId)
        .eq("template", template)
        .in("status", ["sent", "skipped"]);
      if ((count ?? 0) > 0) return;
    }

    const { data: order } = await admin
      .from("orders")
      .select(
        "id, order_number, user_id, customer_name, email, phone, payment_method, payment_status, subtotal_paise, discount_paise, shipping_paise, cod_fee_paise, tax_paise, prices_include_tax, tax_breakdown, total_paise, refunded_paise, coupon_code, shipping_address, billing_address, placed_at, paid_at, created_at, order_items ( title, variant_title, sku, hsn_code, gst_rate, quantity, unit_price_paise, line_total_paise )",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return;
    if (template === "invoice" && !isInvoiceable(order.payment_status)) return;

    const siteUrl = await getRequestSiteUrl();
    const emailOrder: EmailOrder = {
      ...order,
      shipping_address: (order.shipping_address ?? {}) as Record<string, string>,
      items: order.order_items ?? [],
    };
    const values = { order_number: order.order_number, customer_name: order.customer_name, store_name: settings.store.name };

    let recipients: string[];
    let subject: string;
    let intro: string;
    let orderUrl: string;

    if (template === "admin_new_order") {
      if (!notifications.notify_admin_new_order || notifications.admin_recipients.length === 0) return;
      recipients = notifications.admin_recipients;
      subject = `New order ${order.order_number} — ${
        order.payment_method === "cod" ? "Cash on Delivery" : order.payment_method === "upi_manual" && order.payment_status !== "paid" ? "UPI payment to check" : "Paid online"
      }`;
      intro = `A new order was placed by ${order.customer_name} (${order.email}, ${order.phone}).`;
      orderUrl = `${siteUrl}/admin/orders/${order.id}`;
    } else {
      const config = notifications.templates[template];
      if (config && !config.enabled) return;
      recipients = [order.email];
      subject = fillTemplate(config?.subject ?? `${HEADINGS[template]} — ${order.order_number}`, values);
      intro = fillTemplate(
        config?.intro || (template === "invoice" ? "Thank you for your payment. Your invoice for order {{order_number}} is attached as a PDF." : ""),
        values,
      );
      orderUrl = order.user_id
        ? `${siteUrl}/account/orders/${encodeURIComponent(order.order_number)}`
        : `${siteUrl}/track-order?order=${encodeURIComponent(order.order_number)}`;
    }

    // Orders paid by UPI to the shop's own UPI ID: tell the customer how to pay.
    if (template === "order_placed" && order.payment_method === "upi_manual" && order.payment_status !== "paid") {
      const { checkout } = settings;
      const line = `To confirm your order, please pay ${(order.total_paise / 100).toFixed(2)} rupees by UPI to ${checkout.upi_id} (${checkout.upi_payee_name || settings.store.name}) with ${order.order_number} in the note. Your order page shows a QR code.`;
      extra = { ...extra, html: `${extra?.html ?? ""}<p style="margin:16px 0;padding:12px 16px;background:#f6e8bd;border-radius:12px">${escapeHtml(line)}</p>`, text: `${extra?.text ?? ""}\n\n${line}` };
    }

    const { html, text } = renderOrderEmail({
      heading: HEADINGS[template],
      intro,
      order: emailOrder,
      ctx: {
        siteUrl,
        storeName: settings.store.name,
        storeEmail: settings.store.email,
        storePhone: settings.store.phone,
        orderUrl,
        extraHtml: extra?.html,
        extraText: extra?.text,
      },
      showItems: template !== "refund_issued",
    });

    // The invoice PDF goes with the payment confirmation (and the separate invoice email).
    let attachments: EmailAttachment[] | undefined;
    if (WITH_INVOICE.includes(template) && (notifications.send_invoice || extra?.force) && isInvoiceable(order.payment_status)) {
      try {
        const pdf = await renderInvoicePdf({ ...order, items: order.order_items ?? [] } as unknown as InvoiceOrder, settings);
        attachments = [{ filename: `Invoice-${order.order_number}.pdf`, content: pdf, contentType: "application/pdf" }];
      } catch (error) {
        logError("notifications.invoice_pdf", error, { orderId });
      }
    }

    const result = await sendEmail({
      to: recipients,
      subject,
      html,
      text,
      replyTo: notifications.reply_to || settings.store.email || undefined,
      fromName: notifications.from_name,
      attachments,
    });

    await admin.from("notification_log").insert({
      order_id: orderId,
      template,
      recipient: recipients.join(", ").slice(0, 500),
      channel: "email",
      status: result.status,
      provider_message_id: result.id ?? null,
      error: result.error ?? null,
    });
  } catch (error) {
    logError("notifications.order", error, { orderId, template });
  }
}

/** Helper for shipment emails: tracking details block. */
export function trackingExtra(input: { carrier?: string | null; trackingNumber?: string | null; trackingUrl?: string | null }) {
  const parts = [
    input.carrier ? `Courier: ${input.carrier}` : null,
    input.trackingNumber ? `Tracking number: ${input.trackingNumber}` : null,
  ].filter(Boolean) as string[];
  if (parts.length === 0 && !input.trackingUrl) return undefined;
  return {
    html: `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#262823;">${parts.map(escapeHtml).join("<br>")}${
      input.trackingUrl
        ? `<br><a href="${escapeHtml(input.trackingUrl)}" style="color:#2E4E36;">Track your parcel</a>`
        : ""
    }</p>`,
    text: [...parts, input.trackingUrl ? `Track: ${input.trackingUrl}` : ""].filter(Boolean).join("\n"),
  };
}

/**
 * WhatsApp notifications are intentionally NOT active. They need an approved
 * WhatsApp Business provider and message templates. This hook exists so a
 * provider can be connected later without changing the order flow.
 */
export async function notifyWhatsApp(_orderId: string, _template: OrderTemplate): Promise<"skipped"> {
  return "skipped";
}

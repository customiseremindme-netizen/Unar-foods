import { formatINR } from "@/lib/money";

export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key] ?? "");
}

export type EmailOrder = {
  order_number: string;
  customer_name: string;
  email: string;
  phone: string;
  payment_method: string;
  payment_status: string;
  subtotal_paise: number;
  discount_paise: number;
  shipping_paise: number;
  cod_fee_paise: number;
  tax_paise: number;
  prices_include_tax: boolean;
  total_paise: number;
  coupon_code: string | null;
  shipping_address: Record<string, string | undefined>;
  items: { title: string; variant_title: string | null; quantity: number; line_total_paise: number }[];
};

export type EmailContext = {
  siteUrl: string;
  storeName: string;
  storeEmail: string;
  storePhone: string;
  orderUrl: string;
  extraHtml?: string;
  extraText?: string;
};

function addressLines(a: Record<string, string | undefined>): string[] {
  return [
    a.full_name,
    a.line1,
    a.line2,
    a.landmark ? `Landmark: ${a.landmark}` : undefined,
    [a.city, a.state, a.pincode].filter(Boolean).join(", "),
    a.phone ? `Phone: ${a.phone}` : undefined,
  ].filter((l): l is string => !!l && l.trim() !== "");
}

/** Branded, email-client-safe HTML (tables + inline styles). */
export function renderOrderEmail(input: {
  heading: string;
  intro: string;
  order: EmailOrder;
  ctx: EmailContext;
  showItems?: boolean;
}): { html: string; text: string } {
  const { order, ctx } = input;
  const rows = order.items
    .map(
      (item) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #e4e2d6;color:#262823;font-size:14px;">${escapeHtml(item.title)}${
          item.variant_title ? ` <span style="color:#6b6e64">(${escapeHtml(item.variant_title)})</span>` : ""
        } × ${item.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e4e2d6;color:#262823;font-size:14px;text-align:right;white-space:nowrap;">${formatINR(item.line_total_paise)}</td>
      </tr>`,
    )
    .join("");

  const totals: [string, string][] = [["Subtotal", formatINR(order.subtotal_paise)]];
  if (order.discount_paise > 0)
    totals.push([`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`, `−${formatINR(order.discount_paise)}`]);
  totals.push(["Shipping", order.shipping_paise === 0 ? "Free" : formatINR(order.shipping_paise)]);
  if (order.cod_fee_paise > 0) totals.push(["Cash on Delivery fee", formatINR(order.cod_fee_paise)]);
  if (order.tax_paise > 0 && !order.prices_include_tax) totals.push(["GST", formatINR(order.tax_paise)]);
  totals.push(["Total", formatINR(order.total_paise)]);

  const totalsHtml = totals
    .map(
      ([label, value], i) => `<tr>
        <td style="padding:4px 0;color:${i === totals.length - 1 ? "#2E4E36" : "#4b4e45"};font-size:${i === totals.length - 1 ? "16px;font-weight:700" : "14px"};">${escapeHtml(label)}</td>
        <td style="padding:4px 0;text-align:right;color:${i === totals.length - 1 ? "#2E4E36" : "#4b4e45"};font-size:${i === totals.length - 1 ? "16px;font-weight:700" : "14px"};">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("");

  const address = addressLines(order.shipping_address).map(escapeHtml).join("<br>");
  const showItems = input.showItems ?? true;

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#F2F1E6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F1E6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FBFAF5;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;text-align:center;background:#F2F1E6;">
          <img src="${ctx.siteUrl}/brand/unar-logo-email.png" width="180" alt="${escapeHtml(ctx.storeName)}" style="display:inline-block;border:0;max-width:180px;height:auto;">
        </td></tr>
        <tr><td style="padding:24px 32px 0;">
          <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:24px;color:#2E4E36;">${escapeHtml(input.heading)}</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#262823;">Hi ${escapeHtml(order.customer_name)},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#262823;">${escapeHtml(input.intro)}</p>
          ${ctx.extraHtml ?? ""}
          <p style="margin:0 0 20px;font-size:14px;color:#4b4e45;">Order <strong style="color:#2E4E36;">${escapeHtml(order.order_number)}</strong></p>
        </td></tr>
        ${
          showItems
            ? `<tr><td style="padding:0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">${totalsHtml}</table>
        </td></tr>
        <tr><td style="padding:20px 32px 0;">
          <p style="margin:0 0 6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#5B6B2C;">Delivering to</p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#262823;">${address}</p>
        </td></tr>`
            : ""
        }
        <tr><td style="padding:28px 32px;" align="center">
          <a href="${ctx.orderUrl}" style="display:inline-block;background:#2E4E36;color:#F2F1E6;text-decoration:none;padding:12px 28px;border-radius:999px;font-size:14px;font-weight:bold;">View your order</a>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #e4e2d6;text-align:center;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#6b6e64;">Questions? Reply to this email or contact us at ${escapeHtml(ctx.storeEmail)}${
            ctx.storePhone ? ` · ${escapeHtml(ctx.storePhone)}` : ""
          }.</p>
          <p style="margin:8px 0 0;font-size:12px;color:#6b6e64;">${escapeHtml(ctx.storeName)} — One Healthy Habit a Day</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;

  const text = [
    input.heading,
    "",
    `Hi ${order.customer_name},`,
    input.intro,
    ctx.extraText ?? "",
    `Order ${order.order_number}`,
    "",
    ...(showItems
      ? [
          ...order.items.map(
            (i) => `- ${i.title}${i.variant_title ? ` (${i.variant_title})` : ""} × ${i.quantity}: ${formatINR(i.line_total_paise)}`,
          ),
          "",
          ...totals.map(([l, v]) => `${l}: ${v}`),
          "",
          "Delivering to:",
          ...addressLines(order.shipping_address),
          "",
        ]
      : []),
    `View your order: ${ctx.orderUrl}`,
    "",
    `Questions? Contact us at ${ctx.storeEmail}${ctx.storePhone ? ` / ${ctx.storePhone}` : ""}.`,
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  return { html, text };
}

/** Simple branded email with one button (account confirmation, password reset). */
export function renderActionEmail(input: {
  siteUrl: string;
  storeName: string;
  heading: string;
  greetingName?: string | null;
  paragraphs: string[];
  buttonLabel: string;
  buttonUrl: string;
  footnote: string;
}): { html: string; text: string } {
  const paragraphs = input.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#262823;">${escapeHtml(p)}</p>`)
    .join("");
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#F2F1E6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F1E6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FBFAF5;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;text-align:center;background:#F2F1E6;">
          <img src="${input.siteUrl}/brand/unar-logo-email.png" width="180" alt="${escapeHtml(input.storeName)}" style="display:inline-block;border:0;max-width:180px;height:auto;">
        </td></tr>
        <tr><td style="padding:24px 32px 0;">
          <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:24px;color:#2E4E36;">${escapeHtml(input.heading)}</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#262823;">Hi${input.greetingName ? ` ${escapeHtml(input.greetingName)}` : ""},</p>
          ${paragraphs}
        </td></tr>
        <tr><td style="padding:8px 32px 28px;" align="center">
          <a href="${escapeHtml(input.buttonUrl)}" style="display:inline-block;background:#2E4E36;color:#F2F1E6;text-decoration:none;padding:12px 28px;border-radius:999px;font-size:14px;font-weight:bold;">${escapeHtml(input.buttonLabel)}</a>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #e4e2d6;text-align:center;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#6b6e64;">${escapeHtml(input.footnote)}</p>
          <p style="margin:8px 0 0;font-size:12px;color:#6b6e64;">${escapeHtml(input.storeName)} — One Healthy Habit a Day</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
  const text = [
    input.heading,
    "",
    `Hi${input.greetingName ? ` ${input.greetingName}` : ""},`,
    ...input.paragraphs,
    "",
    `${input.buttonLabel}: ${input.buttonUrl}`,
    "",
    input.footnote,
  ].join("\n");
  return { html, text };
}

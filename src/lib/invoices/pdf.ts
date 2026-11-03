import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import sharp from "sharp";
import type { AllSettings } from "@/lib/settings/schema";
import type { TaxBreakdown } from "@/lib/commerce/types";
import { paymentMethodLabel } from "@/lib/orders/labels";

/** The order fields an invoice needs (the same ones the /invoice page shows). */
export type InvoiceOrder = {
  order_number: string;
  email: string;
  phone: string;
  shipping_address: Record<string, string>;
  billing_address: Record<string, string> | null;
  payment_method: string;
  payment_status: string;
  subtotal_paise: number;
  discount_paise: number;
  shipping_paise: number;
  cod_fee_paise: number;
  tax_paise: number;
  prices_include_tax: boolean;
  tax_breakdown: TaxBreakdown | Record<string, never> | null;
  total_paise: number;
  refunded_paise: number;
  coupon_code: string | null;
  placed_at: string | null;
  paid_at: string | null;
  created_at: string;
  items: {
    title: string;
    variant_title: string | null;
    sku: string | null;
    hsn_code: string | null;
    gst_rate: number | null;
    quantity: number;
    unit_price_paise: number;
    line_total_paise: number;
  }[];
};

/** An invoice is issued only once money has been received. */
export function isInvoiceable(paymentStatus: string): boolean {
  return ["paid", "partially_refunded", "refunded", "cod_collected"].includes(paymentStatus);
}

export { paymentMethodLabel };

const FOREST = rgb(0.18, 0.306, 0.212);
const INK = rgb(0.15, 0.157, 0.137);
const MUTED = rgb(0.35, 0.36, 0.32);
const LINE = rgb(0.85, 0.84, 0.77);

/** The standard PDF fonts only know Western characters; replace anything else so the PDF never fails. */
function clean(text: string | null | undefined): string {
  return String(text ?? "")
    .replace(/₹/g, "Rs.")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

const money = (paise: number) => `Rs. ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatDate(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

/** Loads the shop logo (bundled in /public) as a PNG the PDF can embed; null if that isn't possible. */
async function loadLogo(pdf: PDFDocument, url: string): Promise<PDFImage | null> {
  if (!url.startsWith("/") || url.startsWith("//") || url.includes("..")) return null;
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", url));
    const png = await sharp(bytes).resize({ width: 480, withoutEnlargement: true }).png().toBuffer();
    return await pdf.embedPng(png);
  } catch {
    return null;
  }
}

/** Wraps text to a width, returning the lines. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = clean(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/**
 * Builds the invoice as a PDF (A4). Tax lines appear only when the owner has
 * registered for GST and set up every product's rate — nothing is estimated.
 */
export async function renderInvoicePdf(order: InvoiceOrder, settings: Pick<AllSettings, "store" | "tax" | "brand">): Promise<Uint8Array> {
  const { store, tax, brand } = settings;
  const breakdown = (order.tax_breakdown ?? {}) as TaxBreakdown;
  const isTaxInvoice = tax.gst_registered && !!tax.gstin && !!breakdown?.configured;

  const pdf = await PDFDocument.create();
  pdf.setTitle(`${isTaxInvoice ? "Tax Invoice" : "Invoice"} ${order.order_number}`);
  pdf.setAuthor(clean(store.name));
  pdf.setCreator(clean(store.name));
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [W, H] = [595.28, 841.89];
  const M = 48;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const text = (t: string, x: number, yy: number, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; align?: "left" | "right" } = {}) => {
    const size = opts.size ?? 9.5;
    const font = opts.font ?? regular;
    const s = clean(t);
    const dx = opts.align === "right" ? font.widthOfTextAtSize(s, size) : 0;
    page.drawText(s, { x: x - dx, y: yy, size, font, color: opts.color ?? INK });
  };
  const rule = (yy: number, thickness = 0.6, color = LINE) => page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness, color });
  const ensure = (needed: number) => {
    if (y - needed < M + 40) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };

  // Header: logo (or name) on the left, invoice number and date on the right.
  const logo = await loadLogo(pdf, brand.logo_url);
  if (logo) {
    const w = 130;
    const h = (logo.height / logo.width) * w;
    page.drawImage(logo, { x: M, y: y - h, width: w, height: h });
  } else {
    text(store.name, M, y - 20, { size: 20, font: bold, color: FOREST });
  }
  text(isTaxInvoice ? "Tax Invoice" : "Invoice", W - M, y - 18, { size: 20, font: bold, color: FOREST, align: "right" });
  text(`No. ${order.order_number}`, W - M, y - 36, { align: "right", font: bold });
  text(`Date: ${formatDate(order.paid_at ?? order.placed_at ?? order.created_at)}`, W - M, y - 50, { align: "right" });
  y -= 72;
  rule(y);
  y -= 18;

  // Seller / bill to / ship to columns.
  const billing = order.billing_address ?? order.shipping_address ?? {};
  const ship = order.shipping_address ?? {};
  const addressLines = (a: Record<string, string>) => [
    a.full_name,
    [a.line1, a.line2].filter(Boolean).join(", "),
    [a.city, a.state, a.pincode].filter(Boolean).join(", "),
  ];
  const columns: { title: string; lines: string[] }[] = [
    {
      title: "SOLD BY",
      lines: [
        tax.legal_name || store.legal_name || store.name,
        ...store.address_lines,
        store.email,
        store.phone ? `+91 ${store.phone}` : "",
        tax.gst_registered && tax.gstin ? `GSTIN: ${tax.gstin}` : "",
        store.fssai_license ? `FSSAI Lic. No.: ${store.fssai_license}` : "",
      ],
    },
    { title: "BILL TO", lines: [...addressLines(billing), order.email, order.phone] },
    { title: "SHIP TO", lines: [...addressLines(ship), isTaxInvoice && ship.state ? `Place of supply: ${ship.state}` : ""] },
  ];
  const colW = (W - 2 * M - 24) / 3;
  let lowest = y;
  columns.forEach((col, i) => {
    const x = M + i * (colW + 12);
    let cy = y;
    text(col.title, x, cy, { size: 7.5, font: bold, color: FOREST });
    cy -= 13;
    col.lines.filter((l) => l && l.trim()).forEach((l, j) => {
      for (const part of wrap(l, j === 0 ? bold : regular, 9, colW)) {
        text(part, x, cy, { size: 9, font: j === 0 ? bold : regular });
        cy -= 11.5;
      }
    });
    lowest = Math.min(lowest, cy);
  });
  y = lowest - 8;
  rule(y);
  y -= 20;

  // Items table.
  const cols = isTaxInvoice
    ? [
        { label: "Item", x: M, w: 220 },
        { label: "HSN", x: M + 224, w: 50 },
        { label: "Qty", x: M + 310, w: 30, right: true },
        { label: "Unit price", x: M + 385, w: 70, right: true },
        { label: "GST %", x: M + 425, w: 36, right: true },
        { label: "Amount", x: W - M, w: 70, right: true },
      ]
    : [
        { label: "Item", x: M, w: 280 },
        { label: "Qty", x: M + 330, w: 30, right: true },
        { label: "Unit price", x: M + 420, w: 80, right: true },
        { label: "Amount", x: W - M, w: 80, right: true },
      ];
  for (const c of cols) text(c.label.toUpperCase(), c.x, y, { size: 7.5, font: bold, color: MUTED, align: c.right ? "right" : "left" });
  y -= 7;
  rule(y, 0.8, MUTED);
  y -= 14;
  for (const item of order.items) {
    const name = `${item.title}${item.variant_title ? ` (${item.variant_title})` : ""}`;
    const lines = wrap(name, regular, 9.5, cols[0]!.w);
    ensure(lines.length * 12 + 20);
    lines.forEach((l, i) => text(l, M, y - i * 12));
    const values = isTaxInvoice
      ? [item.hsn_code ?? "-", String(item.quantity), money(item.unit_price_paise), item.gst_rate !== null ? String(item.gst_rate) : "-", money(item.line_total_paise)]
      : [String(item.quantity), money(item.unit_price_paise), money(item.line_total_paise)];
    cols.slice(1).forEach((c, i) => text(values[i]!, c.x, y, { align: c.right ? "right" : "left" }));
    let rowBottom = y - (lines.length - 1) * 12;
    if (item.sku) {
      rowBottom -= 11;
      text(`SKU ${item.sku}`, M, rowBottom, { size: 7.5, color: MUTED });
    }
    y = rowBottom - 8;
    rule(y);
    y -= 14;
  }

  // Totals.
  ensure(140);
  const totals: [string, string, boolean?][] = [["Subtotal", money(order.subtotal_paise)]];
  if (order.discount_paise > 0) totals.push([`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`, `-${money(order.discount_paise)}`]);
  totals.push(["Shipping", money(order.shipping_paise)]);
  if (order.cod_fee_paise > 0) totals.push(["COD fee", money(order.cod_fee_paise)]);
  if (isTaxInvoice && !order.prices_include_tax) totals.push(["GST", money(order.tax_paise)]);
  totals.push(["Total", money(order.total_paise), true]);
  if (order.refunded_paise > 0) totals.push(["Refunded", `-${money(order.refunded_paise)}`]);
  const labelX = W - M - 200;
  for (const [label, value, strong] of totals) {
    if (strong) {
      page.drawLine({ start: { x: labelX, y: y + 9 }, end: { x: W - M, y: y + 9 }, thickness: 0.8, color: MUTED });
      y -= 4;
    }
    text(label, labelX, y, { font: strong ? bold : regular, size: strong ? 11 : 9.5 });
    text(value, W - M, y, { font: strong ? bold : regular, size: strong ? 11 : 9.5, align: "right" });
    y -= strong ? 18 : 14;
  }

  // Tax summary (only from the amounts recorded on the order).
  y -= 6;
  if (isTaxInvoice) {
    text(`Tax summary (${breakdown.mode === "inclusive" ? "included in prices" : "added to prices"})`, M, y, { font: bold, size: 9 });
    y -= 12;
    text(`Taxable value: ${money(breakdown.taxable_paise)}`, M, y, { size: 9 });
    y -= 12;
    text(
      breakdown.intra_state ? `CGST: ${money(breakdown.cgst_paise)}  -  SGST: ${money(breakdown.sgst_paise)}` : `IGST: ${money(breakdown.igst_paise)}`,
      M,
      y,
      { size: 9 },
    );
    y -= 16;
  } else if (order.prices_include_tax) {
    text("Prices are inclusive of all applicable taxes.", M, y, { size: 8.5, color: MUTED });
    y -= 16;
  }

  // Footer.
  ensure(60);
  rule(y);
  y -= 14;
  text(`Payment: ${paymentMethodLabel(order.payment_method)}  -  Status: ${order.payment_status.replace(/_/g, " ")}`, M, y, { size: 8.5, color: MUTED });
  y -= 12;
  if (tax.invoice_footer) {
    for (const l of wrap(tax.invoice_footer, regular, 8.5, W - 2 * M)) {
      text(l, M, y, { size: 8.5, color: MUTED });
      y -= 11;
    }
  }
  text("This is a computer-generated document.", M, y, { size: 8.5, color: MUTED });

  return pdf.save();
}

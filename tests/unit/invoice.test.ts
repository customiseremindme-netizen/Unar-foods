import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { isInvoiceable, renderInvoicePdf, type InvoiceOrder } from "@/lib/invoices/pdf";
import { settingsSchemas } from "@/lib/settings/schema";

const settings = {
  store: settingsSchemas.store.parse({ name: "UNAR", address_lines: ["107 A2-4, Sulochana Villa", "Palladam 641664"], email: "unarfoods@gmail.com", phone: "9994657693" }),
  tax: settingsSchemas.tax.parse({}),
  brand: settingsSchemas.brand.parse({ logo_url: "/brand/unar-logo-transparent.webp" }),
};

const order: InvoiceOrder = {
  order_number: "UNAR-001234",
  email: "asha@example.com",
  phone: "9876543210",
  shipping_address: { full_name: "ஆஷா Customer", line1: "12 Main Road", city: "Palladam", state: "Tamil Nadu", pincode: "641664" },
  billing_address: null,
  payment_method: "razorpay",
  payment_status: "paid",
  subtotal_paise: 41800,
  discount_paise: 0,
  shipping_paise: 5000,
  cod_fee_paise: 0,
  tax_paise: 0,
  prices_include_tax: true,
  tax_breakdown: {},
  total_paise: 46800,
  refunded_paise: 0,
  coupon_code: null,
  placed_at: "2026-11-03 10:00:00.000",
  paid_at: "2026-11-03 10:01:00.000",
  created_at: "2026-11-03 10:00:00.000",
  items: [
    { title: "UNAR Dehydrated Banana Chewy — With Dry Fruits & Seeds", variant_title: "100 g", sku: "UNAR-BC-NUTS-100", hsn_code: null, gst_rate: null, quantity: 2, unit_price_paise: 14900, line_total_paise: 29800 },
    { title: "UNAR Dehydrated Banana Chewy — Fresh Raw Banana", variant_title: "100 g", sku: "UNAR-BC-RAW-100", hsn_code: null, gst_rate: null, quantity: 1, unit_price_paise: 12000, line_total_paise: 12000 },
  ],
};

describe("invoice PDF", () => {
  it("is only issued once money has been received", () => {
    expect(isInvoiceable("paid")).toBe(true);
    expect(isInvoiceable("cod_collected")).toBe(true);
    expect(isInvoiceable("unpaid")).toBe(false);
    expect(isInvoiceable("cod_pending")).toBe(false);
  });

  it("renders a valid PDF, even with characters the standard fonts can't print", async () => {
    const bytes = await renderInvoicePdf(order, settings);
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Invoice UNAR-001234");
  });

  it("adds pages for long orders", async () => {
    const many = { ...order, items: Array.from({ length: 60 }, () => order.items[0]!) };
    const doc = await PDFDocument.load(await renderInvoicePdf(many, settings));
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});

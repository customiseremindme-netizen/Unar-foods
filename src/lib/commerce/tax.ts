import type { TaxBreakdown } from "./types";

type TaxLine = { lineTotalPaise: number; gstRate: number | null };

export type TaxSettings = {
  gst_registered: boolean;
  prices_include_tax: boolean;
  seller_state: string;
};

/** Splits a discount across lines in proportion to their value (last line takes the remainder). */
export function allocateDiscount(lineTotals: number[], discountPaise: number): number[] {
  const total = lineTotals.reduce((a, b) => a + b, 0);
  if (total <= 0 || discountPaise <= 0) return lineTotals.map(() => 0);
  const shares: number[] = [];
  let allocated = 0;
  lineTotals.forEach((value, i) => {
    if (i === lineTotals.length - 1) {
      shares.push(discountPaise - allocated);
    } else {
      const share = Math.floor((discountPaise * value) / total);
      shares.push(share);
      allocated += share;
    }
  });
  return shares;
}

/**
 * GST on goods. Only calculated when the business is GST-registered AND
 * every product has a GST rate entered by the owner. We never guess a rate.
 * Shipping charges are not taxed here; ask your accountant how you want
 * shipping treated before enabling GST invoices.
 */
export function calculateTax(input: {
  lines: TaxLine[];
  discountPaise: number;
  settings: TaxSettings;
  buyerState: string | null;
}): { taxPaise: number; breakdown: TaxBreakdown } {
  const mode = input.settings.prices_include_tax ? "inclusive" : "exclusive";
  const intraState =
    !!input.buyerState && input.buyerState.trim().toLowerCase() === input.settings.seller_state.trim().toLowerCase();

  const empty: TaxBreakdown = {
    configured: false,
    mode,
    intra_state: intraState,
    taxable_paise: 0,
    cgst_paise: 0,
    sgst_paise: 0,
    igst_paise: 0,
    rates: [],
  };

  if (!input.settings.gst_registered) return { taxPaise: 0, breakdown: empty };
  if (input.lines.length === 0) return { taxPaise: 0, breakdown: empty };
  if (input.lines.some((l) => l.gstRate === null || l.gstRate === undefined)) {
    return { taxPaise: 0, breakdown: { ...empty, note: "GST rate missing for one or more products." } };
  }

  const discounts = allocateDiscount(
    input.lines.map((l) => l.lineTotalPaise),
    input.discountPaise,
  );

  const byRate = new Map<number, { taxable: number; tax: number }>();
  input.lines.forEach((line, i) => {
    const net = Math.max(0, line.lineTotalPaise - discounts[i]);
    const rate = Number(line.gstRate);
    const tax = mode === "inclusive" ? Math.round((net * rate) / (100 + rate)) : Math.round((net * rate) / 100);
    const taxable = mode === "inclusive" ? net - tax : net;
    const current = byRate.get(rate) ?? { taxable: 0, tax: 0 };
    byRate.set(rate, { taxable: current.taxable + taxable, tax: current.tax + tax });
  });

  const rates = [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, v]) => ({ rate, taxable_paise: v.taxable, tax_paise: v.tax }));
  const taxPaise = rates.reduce((sum, r) => sum + r.tax_paise, 0);
  const taxable = rates.reduce((sum, r) => sum + r.taxable_paise, 0);
  const cgst = intraState ? Math.floor(taxPaise / 2) : 0;
  const sgst = intraState ? taxPaise - cgst : 0;

  return {
    taxPaise,
    breakdown: {
      configured: true,
      mode,
      intra_state: intraState,
      taxable_paise: taxable,
      cgst_paise: cgst,
      sgst_paise: sgst,
      igst_paise: intraState ? 0 : taxPaise,
      rates,
    },
  };
}

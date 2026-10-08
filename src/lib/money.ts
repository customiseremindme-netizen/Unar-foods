/**
 * Money helpers. All amounts are integer PAISE (₹1 = 100 paise).
 */

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const inrFormatterFixed = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹149 or ₹149.50 */
export function formatINR(paise: number | null | undefined): string {
  const value = (paise ?? 0) / 100;
  return Number.isInteger(value) ? inrFormatter.format(value) : inrFormatterFixed.format(value);
}

/** Always two decimals: ₹149.00 (used on invoices). */
export function formatINRFixed(paise: number | null | undefined): string {
  return inrFormatterFixed.format((paise ?? 0) / 100);
}

/** Parses a rupee amount typed by an admin ("149", "149.50", "₹1,299") into paise. */
export function rupeesToPaise(input: string | number): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) : null;
  }
  const cleaned = input.replace(/[₹,\s]/g, "").replace(/^Rs\.?/i, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** Paise to a plain rupee string for form inputs: 14900 → "149", 14950 → "149.50" */
export function paiseToRupeesInput(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return "";
  const rupees = Math.floor(paise / 100);
  const rem = paise % 100;
  return rem === 0 ? String(rupees) : `${rupees}.${String(rem).padStart(2, "0")}`;
}

export function discountPercent(mrpPaise: number, pricePaise: number): number {
  if (mrpPaise <= 0 || pricePaise >= mrpPaise) return 0;
  return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
}

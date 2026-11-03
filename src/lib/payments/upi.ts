import "server-only";
import QRCode from "qrcode";

/**
 * A standard UPI payment link (works with Google Pay, PhonePe, Paytm, BHIM and
 * every bank's UPI app) for the shop's own UPI ID, with the exact amount and
 * the order number as the note.
 */
export function upiPaymentLink(input: { upiId: string; payeeName: string; amountPaise: number; orderNumber: string }): string {
  const params = new URLSearchParams({
    pa: input.upiId,
    pn: input.payeeName || "UNAR",
    am: (input.amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: `Order ${input.orderNumber}`,
    tr: input.orderNumber,
  });
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

/** The same link as a QR code (SVG) for paying from another phone. */
export async function upiQrSvg(link: string): Promise<string> {
  return QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#223b29", light: "#ffffff" } });
}

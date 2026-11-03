import "server-only";
import { getAllSettings } from "@/lib/settings";
import { upiPaymentLink, upiQrSvg } from "@/lib/payments/upi";
import type { UpiDetails } from "@/components/orders/order-detail";

/** UPI payment link + QR for an order waiting for payment to the shop's UPI ID (otherwise null). */
export async function upiDetailsFor(order: { payment_method: string; status: string; total_paise: number; order_number: string }): Promise<UpiDetails | null> {
  if (order.payment_method !== "upi_manual" || order.status !== "pending_payment") return null;
  const { checkout, store } = await getAllSettings();
  if (!checkout.upi_id) return null;
  const payeeName = checkout.upi_payee_name || store.name;
  const link = upiPaymentLink({ upiId: checkout.upi_id, payeeName, amountPaise: order.total_paise, orderNumber: order.order_number });
  return { link, qrSvg: await upiQrSvg(link), upiId: checkout.upi_id, payeeName };
}

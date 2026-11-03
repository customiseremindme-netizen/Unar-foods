import { getOrderForViewer } from "@/lib/orders/view";
import { getAllSettings } from "@/lib/settings";
import { isInvoiceable, renderInvoicePdf } from "@/lib/invoices/pdf";
import { logError } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

/**
 * Downloads the invoice as a PDF. Same access rule as the invoice page: the
 * customer who placed the order, the private order link, or staff.
 */
export async function GET(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const token = new URL(request.url).searchParams.get("token");
  const order = await getOrderForViewer(decodeURIComponent(orderNumber), token, { allowStaff: true });
  if (!order || !isInvoiceable(order.payment_status)) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  try {
    const pdf = await renderInvoicePdf(order, await getAllSettings());
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="Invoice-${order.order_number}.pdf"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    logError("invoice.pdf", error, { order: order.order_number });
    return new Response("Could not create the PDF. Please use Print instead.", { status: 500 });
  }
}

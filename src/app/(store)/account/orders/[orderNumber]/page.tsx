import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getOrderForViewer } from "@/lib/orders/view";
import { OrderDetail } from "@/components/orders/order-detail";

export default async function AccountOrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  await requireUser(`/account/orders/${orderNumber}`);
  const order = await getOrderForViewer(decodeURIComponent(orderNumber), null);
  if (!order) notFound();
  return (
    <div>
      <Link href="/account/orders" className="text-[0.85rem] text-forest underline underline-offset-4">
        ← All orders
      </Link>
      <h1 className="mb-8 mt-4 text-[2.2rem]">Order {order.order_number}</h1>
      <OrderDetail order={order} token={null} />
    </div>
  );
}

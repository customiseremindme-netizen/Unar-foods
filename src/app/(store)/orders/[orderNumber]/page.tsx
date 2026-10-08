import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getOrderForViewer } from "@/lib/orders/view";
import { OrderDetail } from "@/components/orders/order-detail";
import { ButtonLink } from "@/components/ui/button";
import { LeafSprig } from "@/components/brand/botanical";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ orderNumber }, { token }] = await Promise.all([params, searchParams]);
  const order = await getOrderForViewer(decodeURIComponent(orderNumber), token ?? null);
  if (!order) notFound();

  const confirmed = order.status === "placed";

  return (
    <div className="container-site py-12 lg:py-16">
      <div className="paper relative mb-12 overflow-hidden rounded-[2.5rem] bg-paper px-6 py-12 text-center sm:px-12">
        <LeafSprig className="absolute -right-2 top-2 hidden h-40 w-28 text-sage sm:block" />
        {confirmed ? <CheckCircle2 className="mx-auto size-12 text-success" strokeWidth={1.4} aria-hidden="true" /> : null}
        <h1 className="mt-4 text-[2.2rem] sm:text-[2.8rem]">
          {confirmed ? `Thank you, ${order.customer_name.split(" ")[0]}!` : `Order ${order.order_number}`}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-muted">
          {confirmed
            ? `Your order ${order.order_number} is confirmed. We've sent the details to ${order.email}.`
            : "Here is the latest status of your order."}
        </p>
        {confirmed && token ? (
          <p className="mx-auto mt-2 max-w-lg text-[0.8rem] text-muted">
            Keep this page&apos;s link private — it lets you view this order without signing in.
          </p>
        ) : null}
      </div>
      <OrderDetail order={order} token={token ?? null} />
      <div className="mt-12 flex flex-wrap gap-3">
        <ButtonLink href="/shop" variant="secondary">
          Continue shopping
        </ButtonLink>
        {order.user_id ? (
          <ButtonLink href="/account/orders" variant="ghost">
            View all my orders
          </ButtonLink>
        ) : null}
      </div>
    </div>
  );
}

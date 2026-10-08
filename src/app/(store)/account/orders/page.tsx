import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OrderList, type OrderListItem } from "@/components/account/order-list";
import { EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export default async function AccountOrdersPage() {
  const user = await requireUser("/account/orders");
  const supabase = await createSupabaseServerClient();
  const { data: orders } = await supabase!
    .from("orders")
    .select("order_number, status, payment_status, fulfillment_status, payment_method, total_paise, created_at, order_items(quantity)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <div>
      <h1 className="mb-8 text-[2.2rem]">Your orders</h1>
      {orders && orders.length > 0 ? (
        <OrderList orders={orders as OrderListItem[]} />
      ) : (
        <EmptyState title="No orders yet" description="When you place an order it will appear here." action={<ButtonLink href="/shop">Start shopping</ButtonLink>} />
      )}
    </div>
  );
}

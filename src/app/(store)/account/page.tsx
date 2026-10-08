import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OrderList, type OrderListItem } from "@/components/account/order-list";
import { EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export default async function AccountOverviewPage() {
  const user = await requireUser("/account");
  const supabase = await createSupabaseServerClient();
  const [{ data: profile }, { data: orders }] = await Promise.all([
    supabase!.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase!
      .from("orders")
      .select("order_number, status, payment_status, fulfillment_status, payment_method, total_paise, created_at, order_items(quantity)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  return (
    <div className="space-y-10">
      <h1 className="text-[2.2rem]">Hello{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
      <section aria-labelledby="recent-orders">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="recent-orders" className="text-[1.4rem]">
            Recent orders
          </h2>
          <Link href="/account/orders" className="text-[0.88rem] font-semibold text-forest underline underline-offset-4">
            View all
          </Link>
        </div>
        {orders && orders.length > 0 ? (
          <OrderList orders={orders as OrderListItem[]} />
        ) : (
          <EmptyState title="No orders yet" description="When you place an order it will appear here." action={<ButtonLink href="/shop">Start shopping</ButtonLink>} />
        )}
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/account/addresses" className="rounded-[1.5rem] border border-line bg-paper p-6 transition-colors hover:border-forest">
          <p className="font-display text-[1.3rem] text-forest">Saved addresses</p>
          <p className="mt-1 text-[0.88rem] text-muted">Add or edit delivery addresses for faster checkout.</p>
        </Link>
        <Link href="/account/profile" className="rounded-[1.5rem] border border-line bg-paper p-6 transition-colors hover:border-forest">
          <p className="font-display text-[1.3rem] text-forest">Profile & password</p>
          <p className="mt-1 text-[0.88rem] text-muted">Update your name, phone, email preferences and password.</p>
        </Link>
      </div>
    </div>
  );
}

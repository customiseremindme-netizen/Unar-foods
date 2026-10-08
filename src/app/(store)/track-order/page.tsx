import type { Metadata } from "next";
import Link from "next/link";
import { TrackOrderForm } from "@/components/orders/track-form";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check the status of your UNAR order with your order number and the email or mobile number used at checkout.",
  alternates: { canonical: "/track-order" },
};

export default async function TrackOrderPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  const initial = order && /^UNAR-\d{4,}$/i.test(order) ? order.toUpperCase() : "";
  return (
    <div className="container-site max-w-3xl py-12 lg:py-16">
      <p className="eyebrow">Orders</p>
      <h1 className="mt-3 text-[2.4rem] sm:text-[3rem]">Track your order</h1>
      <p className="mt-3 text-muted">
        Enter your order number (from your confirmation email) and the email address or mobile number you used at checkout.
        Have an account?{" "}
        <Link href="/account/orders" className="font-semibold text-forest underline underline-offset-4">
          See all your orders
        </Link>
        .
      </p>
      <div className="mt-10">
        <TrackOrderForm initialOrder={initial} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { CartPageClient } from "@/components/cart/cart-page";

export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: true } };

export default function CartPage() {
  return (
    <div className="container-site py-10 lg:py-14">
      <h1 className="mb-10 text-[2.4rem] sm:text-[3rem]">Your cart</h1>
      <CartPageClient />
    </div>
  );
}

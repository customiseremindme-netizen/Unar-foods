import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { getPublishedProducts } from "@/lib/data/catalog";
import { getApprovedReviews, reviewStats } from "@/lib/data/reviews";
import { getWishlistIds } from "@/lib/wishlist";
import { getSessionUser } from "@/lib/auth/session";
import { ProductCard } from "@/components/product/product-card";
import { EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "My wishlist", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const [ids, products, reviews, user] = await Promise.all([getWishlistIds(), getPublishedProducts(), getApprovedReviews(), getSessionUser()]);
  const saved = ids.map((id) => products.find((p) => p.id === id)).filter((p) => !!p);
  return (
    <div className="container-site py-12 lg:py-16">
      <p className="eyebrow">Saved for later</p>
      <h1 className="mt-3 text-[2.4rem] sm:text-[3rem]">My wishlist</h1>
      {!user && saved.length > 0 ? (
        <p className="mt-3 text-[0.9rem] text-muted">Saved on this device. Sign in and your wishlist moves into your account.</p>
      ) : null}
      {saved.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={<Heart className="size-10" aria-hidden="true" />}
          title="Nothing saved yet"
          description="Tap the heart on any product to save it here."
          action={<ButtonLink href="/shop">Browse the shop</ButtonLink>}
        />
      ) : (
        <div className="mt-10 grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {saved.map((p) => (
            <ProductCard key={p.id} product={p} stats={reviewStats(reviews.filter((r) => r.product_id === p.id))} />
          ))}
        </div>
      )}
    </div>
  );
}

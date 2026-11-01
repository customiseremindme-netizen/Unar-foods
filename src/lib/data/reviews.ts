import "server-only";
import { cache } from "react";
import { getPublicDb } from "@/lib/db/client";
import { logError } from "@/lib/monitoring";
import { reviewMediaUrl } from "@/lib/reviews/media";

export type PublicReview = {
  id: string;
  product_id: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string;
  is_verified_purchase: boolean;
  admin_reply: string | null;
  created_at: string;
  media: { id: string; kind: "image" | "video"; url: string; width: number | null; height: number | null }[];
};

export type ReviewStats = { count: number; average: number; /** how many reviews gave 5, 4, 3, 2 and 1 stars */ distribution: [number, number, number, number, number] };

/** Approved reviews only (row level security hides everything else). */
export const getApprovedReviews = cache(async (): Promise<PublicReview[]> => {
  const db = getPublicDb();
  if (!db) return [];
  const { data, error } = await db
    .from("reviews")
    .select("id, product_id, author_name, rating, title, body, is_verified_purchase, admin_reply, created_at, review_media(id, kind, width, height, sort_order)")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    logError("reviews.list", error);
    return [];
  }
  return (data ?? []).map(({ review_media, ...r }) => ({
    ...r,
    media: [...(review_media ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({ id: m.id, kind: m.kind as "image" | "video", url: reviewMediaUrl(m.id, m.kind as "image" | "video"), width: m.width, height: m.height })),
  }));
});

export async function getProductReviews(productId: string): Promise<PublicReview[]> {
  return (await getApprovedReviews()).filter((r) => r.product_id === productId);
}

export function reviewStats(reviews: PublicReview[]): ReviewStats | null {
  if (reviews.length === 0) return null;
  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const distribution = [5, 4, 3, 2, 1].map((stars) => reviews.filter((r) => r.rating === stars).length) as ReviewStats["distribution"];
  return { count: reviews.length, average: Math.round(average * 10) / 10, distribution };
}

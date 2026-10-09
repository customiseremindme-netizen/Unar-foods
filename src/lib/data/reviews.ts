import "server-only";
import { cache } from "react";
import { getPublicDb } from "@/lib/db/client";
import { logError } from "@/lib/monitoring";

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
};

export type ReviewStats = { count: number; average: number };

/** Approved reviews only (row level security hides everything else). */
export const getApprovedReviews = cache(async (): Promise<PublicReview[]> => {
  const db = getPublicDb();
  if (!db) return [];
  const { data, error } = await db
    .from("reviews")
    .select("id, product_id, author_name, rating, title, body, is_verified_purchase, admin_reply, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    logError("reviews.list", error);
    return [];
  }
  return data ?? [];
});

export async function getProductReviews(productId: string): Promise<PublicReview[]> {
  return (await getApprovedReviews()).filter((r) => r.product_id === productId);
}

export function reviewStats(reviews: PublicReview[]): ReviewStats | null {
  if (reviews.length === 0) return null;
  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return { count: reviews.length, average: Math.round(average * 10) / 10 };
}

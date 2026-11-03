import "server-only";
import { cookies } from "next/headers";
import { getServiceDb } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { logError } from "@/lib/monitoring";

/** Guests' saved products live in this cookie (product ids, newest first). */
export const WISHLIST_COOKIE = "unar_wishlist";
export const WISHLIST_MAX = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function readGuestWishlist(): Promise<string[]> {
  const raw = (await cookies()).get(WISHLIST_COOKIE)?.value ?? "";
  return [...new Set(raw.split(".").filter((id) => UUID.test(id)))].slice(0, WISHLIST_MAX);
}

/**
 * The visitor's saved product ids. For a signed-in customer, anything saved
 * while browsing as a guest is moved into their account the first time.
 */
export async function getWishlistIds(): Promise<string[]> {
  const user = await getSessionUser();
  if (!user) return readGuestWishlist();
  const db = getServiceDb();
  if (!db) return [];
  try {
    const guest = await readGuestWishlist();
    if (guest.length) {
      const { data: existing } = await db.from("products").select("id").in("id", guest);
      const valid = (existing ?? []).map((p) => p.id);
      if (valid.length) {
        await db.from("wishlist_items").upsert(valid.map((product_id) => ({ user_id: user.id, product_id })), { onConflict: "user_id,product_id", ignoreDuplicates: true });
      }
      try {
        (await cookies()).delete(WISHLIST_COOKIE);
      } catch {
        // Cookies can only be changed in actions/route handlers; it's cleared on the next save.
      }
    }
    const { data } = await db.from("wishlist_items").select("product_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(WISHLIST_MAX);
    return (data ?? []).map((r) => r.product_id);
  } catch (error) {
    logError("wishlist.read", error);
    return [];
  }
}

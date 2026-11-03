"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { getServiceDb } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { getWishlistIds, readGuestWishlist, WISHLIST_COOKIE, WISHLIST_MAX } from "@/lib/wishlist";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { logError } from "@/lib/monitoring";

/** Saves or removes a product from the visitor's wishlist. Returns the new list. */
export async function toggleWishlistAction(productId: string, save: boolean): Promise<{ ok: boolean; ids: string[]; message?: string }> {
  const id = z.uuid().safeParse(productId);
  if (!id.success) return { ok: false, ids: [], message: "Unknown product." };
  if (!(await checkRateLimit("wishlist", await getClientIp()))) return { ok: false, ids: await getWishlistIds(), message: "Please slow down a little." };
  const db = getServiceDb();
  if (!db) return { ok: false, ids: [], message: "Saving isn't available right now." };
  const { data: product } = await db.from("products").select("id, status").eq("id", id.data).maybeSingle();
  if (save && product?.status !== "published") return { ok: false, ids: await getWishlistIds(), message: "This product isn't available." };

  const user = await getSessionUser();
  try {
    if (user) {
      await getWishlistIds(); // moves any guest items into the account first
      if (save) {
        await db.from("wishlist_items").upsert({ user_id: user.id, product_id: id.data }, { onConflict: "user_id,product_id", ignoreDuplicates: true });
      } else {
        await db.from("wishlist_items").delete().eq("user_id", user.id).eq("product_id", id.data);
      }
      (await cookies()).delete(WISHLIST_COOKIE);
      return { ok: true, ids: await getWishlistIds() };
    }
    const current = (await readGuestWishlist()).filter((x) => x !== id.data);
    const ids = (save ? [id.data, ...current] : current).slice(0, WISHLIST_MAX);
    (await cookies()).set(WISHLIST_COOKIE, ids.join("."), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 180 * 24 * 60 * 60 });
    return { ok: true, ids };
  } catch (error) {
    logError("wishlist.toggle", error);
    return { ok: false, ids: await getWishlistIds(), message: "We couldn't save that. Please try again." };
  }
}

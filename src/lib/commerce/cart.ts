import "server-only";
import { cookies } from "next/headers";
import { getAdminSupabase, type AdminSupabase } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { getPublicSettings } from "@/lib/settings";
import { logError } from "@/lib/monitoring";
import type { QuoteLine } from "./types";

/**
 * Server-side shopping cart.
 *
 * Carts live in the database and are only ever read or written by trusted
 * server code. A guest cart is identified by a random, httpOnly cookie; a
 * signed-in customer's cart is linked to their account, and a guest cart is
 * merged into it when they sign in.
 */

export const CART_COOKIE = "unar_cart";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 days
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CartRow = {
  id: string;
  user_id: string | null;
  coupon_code: string | null;
  email: string | null;
  recovery_consent: boolean;
};

export type CartLine = {
  variantId: string;
  productSlug: string;
  title: string;
  shortTitle: string;
  variantTitle: string;
  sku: string;
  imageUrl: string | null;
  imageAlt: string;
  unitPricePaise: number;
  mrpPaise: number;
  quantity: number;
  lineTotalPaise: number;
  stock: number;
  available: boolean;
  maxQuantity: number;
  problem: string | null;
};

export type CartView = {
  id: string | null;
  lines: CartLine[];
  itemCount: number;
  subtotalPaise: number;
  couponCode: string | null;
};

export const EMPTY_CART: CartView = { id: null, lines: [], itemCount: 0, subtotalPaise: 0, couponCode: null };

async function readCartCookie(): Promise<string | null> {
  const value = (await cookies()).get(CART_COOKIE)?.value ?? null;
  return value && UUID_RE.test(value) ? value : null;
}

async function writeCartCookie(cartId: string) {
  try {
    (await cookies()).set(CART_COOKIE, cartId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  } catch {
    // Cookies are read-only while rendering a Server Component; ignore.
  }
}

const CART_COLUMNS = "id, user_id, coupon_code, email, recovery_consent";

async function mergeCarts(admin: AdminSupabase, fromId: string, intoId: string) {
  const { data: items } = await admin.from("cart_items").select("variant_id, quantity").eq("cart_id", fromId);
  for (const item of items ?? []) {
    const { data: existing } = await admin
      .from("cart_items")
      .select("quantity")
      .eq("cart_id", intoId)
      .eq("variant_id", item.variant_id)
      .maybeSingle();
    const quantity = Math.min(99, (existing?.quantity ?? 0) + item.quantity);
    await admin
      .from("cart_items")
      .upsert({ cart_id: intoId, variant_id: item.variant_id, quantity }, { onConflict: "cart_id,variant_id" });
  }
  await admin.from("cart_items").delete().eq("cart_id", fromId);
  await admin.from("carts").update({ status: "merged" }).eq("id", fromId);
}

/**
 * Finds the visitor's active cart. When `create` is true a new cart is made
 * if none exists. Handles guest → account merging on sign-in.
 */
export async function resolveCart(options: { create: boolean }): Promise<CartRow | null> {
  const admin = getAdminSupabase();
  if (!admin) return null;
  const user = await getSessionUser();
  const cookieId = await readCartCookie();

  let cookieCart: CartRow | null = null;
  if (cookieId) {
    const { data } = await admin.from("carts").select(CART_COLUMNS).eq("id", cookieId).eq("status", "active").maybeSingle();
    cookieCart = data;
  }

  if (!user) {
    // A guest may only use a cart that does not belong to an account.
    if (cookieCart && cookieCart.user_id === null) return cookieCart;
    if (!options.create) return null;
    const { data, error } = await admin.from("carts").insert({}).select(CART_COLUMNS).single();
    if (error || !data) {
      logError("cart.create", error);
      return null;
    }
    await writeCartCookie(data.id);
    return data;
  }

  const { data: userCart } = await admin
    .from("carts")
    .select(CART_COLUMNS)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (userCart) {
    if (cookieCart && cookieCart.id !== userCart.id && cookieCart.user_id === null) {
      await mergeCarts(admin, cookieCart.id, userCart.id);
    }
    if (cookieId !== userCart.id) await writeCartCookie(userCart.id);
    return userCart;
  }

  if (cookieCart && cookieCart.user_id === null) {
    const { data } = await admin
      .from("carts")
      .update({ user_id: user.id })
      .eq("id", cookieCart.id)
      .select(CART_COLUMNS)
      .single();
    return data ?? cookieCart;
  }

  if (!options.create) return null;
  const { data, error } = await admin.from("carts").insert({ user_id: user.id }).select(CART_COLUMNS).single();
  if (error || !data) {
    logError("cart.create", error);
    return null;
  }
  await writeCartCookie(data.id);
  return data;
}

type ItemRow = {
  quantity: number;
  product_variants: {
    id: string;
    title: string;
    sku: string;
    price_paise: number;
    mrp_paise: number;
    stock: number;
    weight_grams: number;
    is_active: boolean;
    products: {
      id: string;
      slug: string;
      title: string;
      short_title: string | null;
      status: string;
      gst_rate: number | null;
      hsn_code: string | null;
      product_images: { url: string; alt: string; sort_order: number }[];
    } | null;
  } | null;
};

/** Loads cart items with LIVE prices and stock from the database. */
export async function loadCartLines(cartId: string): Promise<(QuoteLine & { shortTitle: string; imageAlt: string })[]> {
  const admin = getAdminSupabase();
  if (!admin) return [];
  const { data, error } = await admin
    .from("cart_items")
    .select(
      `quantity, product_variants ( id, title, sku, price_paise, mrp_paise, stock, weight_grams, is_active,
        products ( id, slug, title, short_title, status, gst_rate, hsn_code, product_images ( url, alt, sort_order ) ) )`,
    )
    .eq("cart_id", cartId)
    .order("added_at");
  if (error) {
    logError("cart.lines", error);
    return [];
  }
  return ((data ?? []) as unknown as ItemRow[])
    .filter((row) => row.product_variants?.products)
    .map((row) => {
      const v = row.product_variants!;
      const p = v.products!;
      const image = [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
      return {
        variantId: v.id,
        productId: p.id,
        productSlug: p.slug,
        title: p.title,
        shortTitle: p.short_title ?? p.title,
        variantTitle: v.title,
        sku: v.sku,
        imageUrl: image?.url ?? null,
        imageAlt: image?.alt ?? p.title,
        unitPricePaise: v.price_paise,
        mrpPaise: v.mrp_paise,
        quantity: row.quantity,
        weightGrams: v.weight_grams,
        gstRate: p.gst_rate === null ? null : Number(p.gst_rate),
        hsnCode: p.hsn_code,
        stock: v.stock,
        available: v.is_active && p.status === "published",
      };
    });
}

export async function buildCartView(cart: CartRow | null): Promise<CartView> {
  if (!cart) return EMPTY_CART;
  const settings = await getPublicSettings();
  const maxPerItem = settings.checkout.max_quantity_per_item;
  const lines = await loadCartLines(cart.id);
  const view: CartLine[] = lines.map((l) => {
    let problem: string | null = null;
    if (!l.available) problem = "No longer available";
    else if (l.stock <= 0) problem = "Out of stock";
    else if (l.quantity > l.stock) problem = `Only ${l.stock} left`;
    return {
      variantId: l.variantId,
      productSlug: l.productSlug,
      title: l.title,
      shortTitle: l.shortTitle,
      variantTitle: l.variantTitle,
      sku: l.sku,
      imageUrl: l.imageUrl,
      imageAlt: l.imageAlt,
      unitPricePaise: l.unitPricePaise,
      mrpPaise: l.mrpPaise,
      quantity: l.quantity,
      lineTotalPaise: l.unitPricePaise * l.quantity,
      stock: l.stock,
      available: l.available,
      maxQuantity: Math.max(0, Math.min(maxPerItem, l.stock)),
      problem,
    };
  });
  return {
    id: cart.id,
    lines: view,
    itemCount: view.reduce((sum, l) => sum + l.quantity, 0),
    subtotalPaise: view.reduce((sum, l) => sum + l.lineTotalPaise, 0),
    couponCode: cart.coupon_code,
  };
}

export async function getCartView(): Promise<CartView> {
  return buildCartView(await resolveCart({ create: false }));
}

export class CartError extends Error {}

/** Adds (or sets) a quantity after validating the product and stock. */
export async function changeCartItem(input: { variantId: string; quantity: number; mode: "add" | "set" }): Promise<{
  cart: CartView;
  message: string | null;
}> {
  const admin = getAdminSupabase();
  if (!admin) throw new CartError("The shop is not connected to its database yet.");
  if (!UUID_RE.test(input.variantId)) throw new CartError("That product could not be found.");

  const settings = await getPublicSettings();
  const maxPerItem = settings.checkout.max_quantity_per_item;

  const { data: variant } = await admin
    .from("product_variants")
    .select("id, stock, is_active, products ( status, title )")
    .eq("id", input.variantId)
    .maybeSingle();
  const product = (variant as unknown as { products: { status: string; title: string } | null } | null)?.products;
  if (!variant || !variant.is_active || product?.status !== "published") {
    throw new CartError("That product is not available.");
  }

  const cart = await resolveCart({ create: input.quantity > 0 || input.mode === "add" });
  if (!cart) throw new CartError("We couldn't open your cart. Please try again.");

  const { data: existing } = await admin
    .from("cart_items")
    .select("quantity")
    .eq("cart_id", cart.id)
    .eq("variant_id", variant.id)
    .maybeSingle();

  let desired = input.mode === "add" ? (existing?.quantity ?? 0) + input.quantity : input.quantity;
  let message: string | null = null;

  if (desired <= 0) {
    await admin.from("cart_items").delete().eq("cart_id", cart.id).eq("variant_id", variant.id);
  } else {
    if (variant.stock <= 0) throw new CartError(`${product.title} is out of stock.`);
    const cap = Math.min(maxPerItem, variant.stock);
    if (desired > cap) {
      desired = cap;
      message =
        cap === variant.stock
          ? `Only ${variant.stock} available — we've added the maximum.`
          : `You can buy up to ${maxPerItem} per order.`;
    }
    const { error } = await admin
      .from("cart_items")
      .upsert({ cart_id: cart.id, variant_id: variant.id, quantity: desired }, { onConflict: "cart_id,variant_id" });
    if (error) {
      logError("cart.upsert", error);
      throw new CartError("We couldn't update your cart. Please try again.");
    }
  }
  await admin.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cart.id);
  return { cart: await buildCartView(cart), message };
}

export async function setCartCoupon(code: string | null): Promise<CartRow | null> {
  const admin = getAdminSupabase();
  const cart = await resolveCart({ create: false });
  if (!admin || !cart) return cart;
  const { data } = await admin.from("carts").update({ coupon_code: code }).eq("id", cart.id).select(CART_COLUMNS).single();
  return data ?? cart;
}

/** Stores the checkout email (and optional reminder consent) on the cart. */
export async function saveCartContact(email: string, consent: boolean) {
  const admin = getAdminSupabase();
  const cart = await resolveCart({ create: false });
  if (!admin || !cart) return;
  await admin
    .from("carts")
    .update({ email: consent ? email : null, recovery_consent: consent })
    .eq("id", cart.id);
}

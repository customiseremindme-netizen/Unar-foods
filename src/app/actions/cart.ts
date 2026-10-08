"use server";

import { z } from "zod";
import { CartError, buildCartView, changeCartItem, getCartView, loadCartLines, resolveCart, setCartCoupon, type CartView } from "@/lib/commerce/cart";
import { quoteLines } from "@/lib/commerce/checkout";
import { normalizeCouponCode } from "@/lib/commerce/coupons";
import type { ShippingQuote } from "@/lib/commerce/types";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { getSessionUser } from "@/lib/auth/session";
import { pincodeSchema, stateSchema } from "@/lib/validation/common";
import { logError } from "@/lib/monitoring";

export type CartSummary = {
  subtotalPaise: number;
  discountPaise: number;
  couponCode: string | null;
  couponError: string | null;
  freeShipping: boolean;
};

export type CartState = { cart: CartView; summary: CartSummary };
export type CartActionResult = { ok: boolean; message: string | null; state: CartState };

async function summarize(cart: CartView): Promise<CartSummary> {
  if (!cart.id || cart.lines.length === 0) {
    return { subtotalPaise: 0, discountPaise: 0, couponCode: cart.couponCode, couponError: null, freeShipping: false };
  }
  const user = await getSessionUser();
  const lines = await loadCartLines(cart.id);
  const { quote } = await quoteLines({
    lines,
    couponCode: cart.couponCode,
    destination: null,
    paymentMethod: "razorpay",
    email: user?.email ?? null,
    userId: user?.id ?? null,
  });
  return {
    subtotalPaise: quote.subtotalPaise,
    discountPaise: quote.discountPaise,
    couponCode: cart.couponCode,
    couponError: quote.couponError,
    freeShipping: quote.coupon?.freeShipping ?? false,
  };
}

async function state(cart?: CartView): Promise<CartState> {
  const view = cart ?? (await getCartView());
  return { cart: view, summary: await summarize(view) };
}

async function allowed(): Promise<boolean> {
  return checkRateLimit("cart", await getClientIp());
}

export async function getCartAction(): Promise<CartState> {
  try {
    return await state();
  } catch (error) {
    logError("cart.get", error);
    return state({ id: null, lines: [], itemCount: 0, subtotalPaise: 0, couponCode: null });
  }
}

const itemSchema = z.object({ variantId: z.uuid(), quantity: z.number().int().min(0).max(99) });

export async function addToCartAction(variantId: string, quantity: number): Promise<CartActionResult> {
  const parsed = itemSchema.safeParse({ variantId, quantity });
  if (!parsed.success || parsed.data.quantity < 1) return { ok: false, message: "Invalid quantity.", state: await state() };
  if (!(await allowed())) return { ok: false, message: "Too many requests. Please wait a moment.", state: await state() };
  try {
    const { cart, message } = await changeCartItem({ ...parsed.data, mode: "add" });
    return { ok: true, message, state: await state(cart) };
  } catch (error) {
    if (error instanceof CartError) return { ok: false, message: error.message, state: await state() };
    logError("cart.add", error);
    return { ok: false, message: "We couldn't add that to your cart. Please try again.", state: await state() };
  }
}

export async function updateCartItemAction(variantId: string, quantity: number): Promise<CartActionResult> {
  const parsed = itemSchema.safeParse({ variantId, quantity });
  if (!parsed.success) return { ok: false, message: "Invalid quantity.", state: await state() };
  if (!(await allowed())) return { ok: false, message: "Too many requests. Please wait a moment.", state: await state() };
  try {
    const { cart, message } = await changeCartItem({ ...parsed.data, mode: "set" });
    return { ok: true, message, state: await state(cart) };
  } catch (error) {
    if (error instanceof CartError) return { ok: false, message: error.message, state: await state() };
    logError("cart.update", error);
    return { ok: false, message: "We couldn't update your cart. Please try again.", state: await state() };
  }
}

export async function applyCouponAction(code: string): Promise<CartActionResult> {
  const normalized = normalizeCouponCode(String(code ?? "")).slice(0, 32);
  if (!/^[A-Z0-9_-]{3,32}$/.test(normalized)) return { ok: false, message: "Enter a valid coupon code.", state: await state() };
  if (!(await checkRateLimit("coupon", await getClientIp()))) {
    return { ok: false, message: "Too many attempts. Please wait a few minutes.", state: await state() };
  }
  const cart = await resolveCart({ create: false });
  if (!cart) return { ok: false, message: "Add something to your cart first.", state: await state() };
  const updated = await setCartCoupon(normalized);
  const result = await state(await buildCartView(updated));
  if (result.summary.couponError) {
    await setCartCoupon(null);
    return { ok: false, message: result.summary.couponError, state: await state() };
  }
  return { ok: true, message: `Coupon ${normalized} applied.`, state: result };
}

export async function removeCouponAction(): Promise<CartActionResult> {
  const updated = await setCartCoupon(null);
  return { ok: true, message: "Coupon removed.", state: await state(await buildCartView(updated)) };
}

export type ShippingEstimate = { ok: boolean; message: string | null; shipping: ShippingQuote | null; totalPaise: number | null };

export async function estimateShippingAction(pincode: string, state: string): Promise<ShippingEstimate> {
  const parsed = pincodeSchema.safeParse(pincode);
  if (!parsed.success) return { ok: false, message: "Enter a valid 6-digit PIN code.", shipping: null, totalPaise: null };
  const parsedState = stateSchema.safeParse(state);
  if (!parsedState.success) return { ok: false, message: "Select your state.", shipping: null, totalPaise: null };
  if (!(await allowed())) return { ok: false, message: "Too many requests. Please wait a moment.", shipping: null, totalPaise: null };
  const cart = await resolveCart({ create: false });
  if (!cart) return { ok: false, message: "Your cart is empty.", shipping: null, totalPaise: null };
  const user = await getSessionUser();
  const lines = await loadCartLines(cart.id);
  const { quote } = await quoteLines({
    lines,
    couponCode: cart.coupon_code,
    destination: { pincode: parsed.data, state: parsedState.data },
    paymentMethod: "razorpay",
    email: user?.email ?? null,
    userId: user?.id ?? null,
  });
  return {
    ok: quote.shipping.status === "ok",
    message: quote.shipping.status === "unserviceable" ? quote.shipping.reason : null,
    shipping: quote.shipping,
    totalPaise: quote.totalPaise,
  };
}

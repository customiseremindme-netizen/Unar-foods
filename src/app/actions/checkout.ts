"use server";

import type { Json } from "@/lib/db/database.types";
import { getServiceDb, getUserDb } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { getAllSettings } from "@/lib/settings";
import { getRazorpayEnv } from "@/lib/env";
import { loadCartLines, resolveCart, saveCartContact } from "@/lib/commerce/cart";
import {
  checkoutSchema,
  describeOrderError,
  quoteLines,
  releaseExpiredReservations,
} from "@/lib/commerce/checkout";
import type { PaymentMethod, Quote } from "@/lib/commerce/types";
import { createRazorpayOrder } from "@/lib/payments/razorpay";
import { notifyOrder } from "@/lib/notifications/order-notifications";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { randomToken, safeEqual, sha256Hex } from "@/lib/security/tokens";
import { revalidateStorefront } from "@/lib/cache";
import { pincodeSchema, stateSchema, toFieldErrors, type FieldErrors } from "@/lib/validation/common";
import { logError } from "@/lib/monitoring";

export type QuoteSummary = Pick<
  Quote,
  | "subtotalPaise"
  | "discountPaise"
  | "shippingPaise"
  | "codFeePaise"
  | "taxPaise"
  | "totalPaise"
  | "codAvailable"
  | "errors"
  | "canCheckout"
  | "couponError"
  | "shipping"
  | "taxBreakdown"
  | "itemCount"
> & { couponCode: string | null };

function summarize(quote: Quote): QuoteSummary {
  return {
    subtotalPaise: quote.subtotalPaise,
    discountPaise: quote.discountPaise,
    shippingPaise: quote.shippingPaise,
    codFeePaise: quote.codFeePaise,
    taxPaise: quote.taxPaise,
    totalPaise: quote.totalPaise,
    codAvailable: quote.codAvailable,
    errors: quote.errors,
    canCheckout: quote.canCheckout,
    couponError: quote.couponError,
    shipping: quote.shipping,
    taxBreakdown: quote.taxBreakdown,
    itemCount: quote.itemCount,
    couponCode: quote.coupon?.code ?? null,
  };
}

/** Live price breakdown for the checkout summary (always computed on the server). */
export async function quoteCheckoutAction(input: {
  pincode: string;
  state: string;
  paymentMethod: PaymentMethod;
  email?: string;
}): Promise<QuoteSummary | null> {
  if (!(await checkRateLimit("cart", await getClientIp()))) return null;
  const cart = await resolveCart({ create: false });
  if (!cart) return null;
  const pin = pincodeSchema.safeParse(input.pincode);
  const st = stateSchema.safeParse(input.state);
  const user = await getSessionUser();
  const { quote } = await quoteLines({
    lines: await loadCartLines(cart.id),
    couponCode: cart.coupon_code,
    destination: pin.success || st.success ? { pincode: pin.success ? pin.data : undefined, state: st.success ? st.data : undefined } : null,
    paymentMethod: input.paymentMethod === "cod" ? "cod" : "razorpay",
    email: input.email?.toLowerCase().trim() || user?.email || null,
    userId: user?.id ?? null,
  });
  return summarize(quote);
}

export type RazorpayCheckoutOptions = {
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: "INR";
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  orderNumber: string;
  accessToken: string;
};

export type PlaceOrderResult =
  | { ok: false; message: string | null; errors?: FieldErrors }
  | { ok: true; kind: "cod"; redirectTo: string }
  | { ok: true; kind: "razorpay"; razorpay: RazorpayCheckoutOptions };

export async function placeOrderAction(payload: unknown): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", errors: toFieldErrors(parsed.error) };
  }
  const input = parsed.data;
  if (input.website) return { ok: false, message: "We couldn't place your order. Please try again." };

  if (!(await checkRateLimit("checkout", await getClientIp()))) {
    return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };
  }

  const admin = getServiceDb();
  if (!admin) return { ok: false, message: "The shop isn't connected to its database yet. Please try again later." };

  const [user, settings] = await Promise.all([getSessionUser(), getAllSettings()]);
  if (settings.maintenance.enabled) {
    return { ok: false, message: "The shop is closed for maintenance right now. Please try again a little later." };
  }
  if (!user && !settings.checkout.guest_checkout_enabled) {
    return { ok: false, message: "Please sign in to place an order." };
  }
  if (input.payment_method === "razorpay" && !getRazorpayEnv()) {
    return { ok: false, message: "Online payment isn't set up yet. Please choose another payment method or contact us." };
  }

  // Free up stock held by abandoned payments before checking availability.
  await releaseExpiredReservations(5).catch((e) => logError("checkout.release", e));

  const cart = await resolveCart({ create: false });
  if (!cart) return { ok: false, message: "Your cart is empty." };
  const lines = await loadCartLines(cart.id);
  if (lines.length === 0) return { ok: false, message: "Your cart is empty." };

  const { quote, coupon } = await quoteLines({
    lines,
    couponCode: cart.coupon_code,
    destination: { pincode: input.shipping.pincode, state: input.shipping.state },
    paymentMethod: input.payment_method,
    email: input.email,
    userId: user?.id ?? null,
  });
  if (cart.coupon_code && quote.couponError) {
    return { ok: false, message: `${quote.couponError} Please remove the coupon to continue.` };
  }
  if (!quote.canCheckout) return { ok: false, message: quote.errors[0] ?? "Your order can't be placed yet." };

  if (input.recovery_consent !== undefined) await saveCartContact(input.email, input.recovery_consent);

  const accessToken = randomToken(32);
  const billing = input.billing_same ? input.shipping : input.billing!;
  const orderPayload = {
    user_id: user?.id ?? "",
    cart_id: cart.id,
    email: input.email,
    phone: input.phone,
    customer_name: input.shipping.full_name,
    shipping_address: { ...input.shipping, country: "India" },
    billing_address: { ...billing, country: "India" },
    payment_method: input.payment_method,
    subtotal_paise: quote.subtotalPaise,
    discount_paise: quote.discountPaise,
    shipping_paise: quote.shippingPaise,
    cod_fee_paise: quote.codFeePaise,
    tax_paise: quote.taxPaise,
    prices_include_tax: settings.tax.prices_include_tax,
    tax_breakdown: quote.taxBreakdown,
    total_paise: quote.totalPaise,
    coupon_id: coupon && quote.coupon ? coupon.id : "",
    coupon_code: quote.coupon?.code ?? "",
    shipping_zone_id: quote.shipping.status === "ok" ? quote.shipping.zoneId : "",
    shipping_method: quote.shipping.status === "ok" ? quote.shipping.zoneName : "",
    customer_note: input.customer_note ?? "",
    access_token_hash: sha256Hex(accessToken),
    reservation_minutes: settings.checkout.reservation_minutes,
    marketing_consent: input.marketing_consent,
    terms_accepted: input.terms,
  };
  const items = quote.lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity, unit_price_paise: l.unitPricePaise }));

  const { data, error } = await admin.rpc("create_order", {
    p_order: orderPayload as unknown as Json,
    p_items: items as unknown as Json,
  });
  if (error || !data) {
    logError("checkout.create_order", error);
    return { ok: false, message: describeOrderError(error?.message ?? "") };
  }
  const created = data as { order_id: string; order_number: string };
  revalidateStorefront();

  // Side tasks — never block the order on these.
  await Promise.allSettled([
    saveCustomerDetails(user?.id ?? null, input),
    input.marketing_consent ? subscribeFromCheckout(input.email, settings.newsletter.consent_text) : Promise.resolve(),
  ]);

  if (input.payment_method === "cod") {
    await notifyOrder(created.order_id, "order_placed");
    await notifyOrder(created.order_id, "admin_new_order");
    return { ok: true, kind: "cod", redirectTo: `/orders/${created.order_number}?token=${accessToken}` };
  }

  try {
    const razorpayOrder = await createRazorpayOrder({
      amountPaise: quote.totalPaise,
      receipt: created.order_number,
      notes: { order_id: created.order_id, order_number: created.order_number },
    });
    const { error: attachError } = await admin.rpc("attach_provider_order", {
      p_order_id: created.order_id,
      p_provider_order_id: razorpayOrder.id,
      p_amount_paise: razorpayOrder.amount,
    });
    if (attachError) throw attachError;
    const env = getRazorpayEnv()!;
    return {
      ok: true,
      kind: "razorpay",
      razorpay: {
        keyId: env.keyId,
        razorpayOrderId: razorpayOrder.id,
        amountPaise: razorpayOrder.amount,
        currency: "INR",
        name: settings.store.name,
        description: `Order ${created.order_number}`,
        prefill: { name: input.shipping.full_name, email: input.email, contact: input.phone },
        orderNumber: created.order_number,
        accessToken,
      },
    };
  } catch (e) {
    logError("checkout.razorpay_order", e, { order: created.order_number });
    await admin.rpc("release_order", { p_order_id: created.order_id, p_new_status: "cancelled", p_reason: "Payment could not be started" });
    revalidateStorefront();
    return { ok: false, message: "We couldn't start the payment. Your card has not been charged. Please try again." };
  }
}

async function saveCustomerDetails(userId: string | null, input: ReturnType<typeof checkoutSchema.parse>) {
  if (!userId) return;
  const db = await getUserDb();
  if (!db) return;
  const { data: profile } = await db.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle();
  if (profile && (!profile.full_name || !profile.phone)) {
    await db
      .from("profiles")
      .update({ full_name: profile.full_name || input.shipping.full_name, phone: profile.phone || input.phone })
      .eq("id", userId);
  }
  if (!input.save_address) return;
  const a = input.shipping;
  const { data: existing } = await db
    .from("addresses")
    .select("id")
    .eq("user_id", userId)
    .eq("line1", a.line1)
    .eq("pincode", a.pincode)
    .limit(1);
  if ((existing ?? []).length > 0) return;
  const { count } = await db.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", userId);
  await db.from("addresses").insert({
    user_id: userId,
    full_name: a.full_name,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? null,
    landmark: a.landmark ?? null,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    is_default: (count ?? 0) === 0,
  });
}

async function subscribeFromCheckout(email: string, consentText: string) {
  const admin = getServiceDb();
  if (!admin) return;
  const { data: existing } = await admin.from("subscribers").select("id, status").eq("email", email).maybeSingle();
  if (existing?.status === "subscribed") return;
  const record = { email, status: "subscribed", consent_text: consentText, consent_at: new Date().toISOString(), source: "checkout", unsubscribed_at: null };
  if (existing) await admin.from("subscribers").update(record).eq("id", existing.id);
  else await admin.from("subscribers").insert({ ...record, unsubscribe_token: randomToken(24) });
}

/** Loads an order the visitor is allowed to act on (owner or holder of the private link token). */
async function authorizedPendingOrder(orderNumber: string, token: string | null) {
  const admin = getServiceDb();
  if (!admin || !/^UNAR-\d{4,}$/.test(orderNumber)) return null;
  const { data: order } = await admin
    .from("orders")
    .select("id, order_number, user_id, status, payment_status, total_paise, access_token_hash, customer_name, email, phone, reservation_expires_at")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (!order) return null;
  const user = await getSessionUser();
  const owns = !!user && order.user_id === user.id;
  const hasToken = !!token && safeEqual(sha256Hex(token), order.access_token_hash);
  return owns || hasToken ? order : null;
}

/** Re-opens payment for an order that is still waiting for payment. */
export async function resumePaymentAction(orderNumber: string, token: string | null): Promise<PlaceOrderResult> {
  if (!(await checkRateLimit("paymentVerify", await getClientIp()))) return { ok: false, message: "Too many attempts. Please wait a moment." };
  const order = await authorizedPendingOrder(orderNumber, token);
  if (!order) return { ok: false, message: "We couldn't find that order." };
  if (order.status !== "pending_payment") return { ok: false, message: "This order is no longer waiting for payment." };
  if (order.reservation_expires_at && new Date(order.reservation_expires_at) < new Date()) {
    return { ok: false, message: "The payment window for this order has closed. Please place a new order." };
  }
  const env = getRazorpayEnv();
  const admin = getServiceDb();
  if (!env || !admin) return { ok: false, message: "Online payment is not available right now." };
  const { data: payment } = await admin
    .from("payments")
    .select("provider_order_id")
    .eq("order_id", order.id)
    .eq("provider", "razorpay")
    .not("provider_order_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!payment?.provider_order_id) return { ok: false, message: "This order can't be paid online. Please contact us." };
  const settings = await getAllSettings();
  return {
    ok: true,
    kind: "razorpay",
    razorpay: {
      keyId: env.keyId,
      razorpayOrderId: payment.provider_order_id,
      amountPaise: order.total_paise,
      currency: "INR",
      name: settings.store.name,
      description: `Order ${order.order_number}`,
      prefill: { name: order.customer_name, email: order.email, contact: order.phone },
      orderNumber: order.order_number,
      accessToken: token ?? "",
    },
  };
}

/** Customer gives up on paying: release the reserved stock immediately. */
export async function cancelPendingOrderAction(orderNumber: string, token: string | null): Promise<{ ok: boolean; message: string }> {
  const order = await authorizedPendingOrder(orderNumber, token);
  if (!order) return { ok: false, message: "We couldn't find that order." };
  if (order.status !== "pending_payment") return { ok: false, message: "This order can no longer be cancelled here." };
  // Make sure the customer didn't actually pay before cancelling.
  const { reconcileOrderPayment } = await import("@/lib/commerce/payments");
  const outcome = await reconcileOrderPayment(order.id);
  if (outcome === "paid") return { ok: false, message: "Good news — your payment went through, so your order is confirmed." };
  const admin = getServiceDb();
  if (!admin) return { ok: false, message: "Please try again." };
  await admin.rpc("release_order", { p_order_id: order.id, p_new_status: "cancelled", p_reason: "Cancelled by customer before payment" });
  revalidateStorefront();
  return { ok: true, message: "Your order was cancelled. You have not been charged." };
}

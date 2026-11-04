"use server";

import type { Json } from "@/lib/db/database.types";
import { getServiceDb, getUserDb } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { getAllSettings } from "@/lib/settings";
import { getPhonePeEnv, getRazorpayEnv } from "@/lib/env";
import { availablePaymentMethods } from "@/lib/commerce/payment-methods";
import { cookies } from "next/headers";
import { createPhonePePayment, newMerchantOrderId } from "@/lib/payments/phonepe";
import { getRequestSiteUrl } from "@/lib/site-url";
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
> & { couponCode: string | null; couponFreeShipping: boolean };

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
    couponFreeShipping: !!quote.coupon?.freeShipping,
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
    paymentMethod: (["razorpay", "phonepe", "upi_manual", "cod"] as const).includes(input.paymentMethod) ? input.paymentMethod : "razorpay",
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
  /** Order placed (cash on delivery, or UPI to the shop's UPI ID): show the order page. */
  | { ok: true; kind: "cod"; redirectTo: string }
  | { ok: true; kind: "razorpay"; razorpay: RazorpayCheckoutOptions }
  /** Payment happens on the provider's own page (PhonePe). */
  | { ok: true; kind: "redirect"; url: string; orderNumber: string; accessToken: string };

/** Keeps the private order link for the customer's return from PhonePe, without sending it to PhonePe. */
const returnCookie = (orderNumber: string) => `unar_pay_${orderNumber.replace(/[^A-Z0-9-]/gi, "")}`;

/** Starts a PhonePe payment attempt for an order that is waiting for payment. */
async function startPhonePe(order: { id: string; order_number: string; total_paise: number }, accessToken: string, minutes: number) {
  const admin = getServiceDb()!;
  const merchantOrderId = newMerchantOrderId(order.order_number);
  const site = await getRequestSiteUrl();
  const payment = await createPhonePePayment({
    merchantOrderId,
    amountPaise: order.total_paise,
    orderNumber: order.order_number,
    redirectUrl: `${site}/api/payments/phonepe/return?order=${encodeURIComponent(order.order_number)}&m=${encodeURIComponent(merchantOrderId)}`,
    expireAfterSeconds: minutes * 60,
  });
  const { error } = await admin.rpc("attach_provider_order", {
    p_order_id: order.id,
    p_provider: "phonepe",
    p_provider_order_id: merchantOrderId,
    p_amount_paise: order.total_paise,
  });
  if (error) throw error;
  if (accessToken) {
    (await cookies()).set(returnCookie(order.order_number), accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && process.env.UNAR_ALLOW_TEST_OVERRIDES !== "1",
      path: "/api/payments/phonepe",
      maxAge: 2 * 60 * 60,
    });
  }
  return payment.redirectUrl;
}

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
  if (!(await availablePaymentMethods(settings)).includes(input.payment_method)) {
    return { ok: false, message: "This way of paying isn't available right now. Please choose another payment method." };
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
    reservation_minutes: input.payment_method === "upi_manual" ? settings.checkout.upi_hold_hours * 60 : settings.checkout.reservation_minutes,
    marketing_consent: input.marketing_consent,
    whatsapp_updates: input.whatsapp_updates === true,
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

  if (input.payment_method === "cod" || input.payment_method === "upi_manual") {
    await notifyOrder(created.order_id, "order_placed");
    await notifyOrder(created.order_id, "admin_new_order");
    return { ok: true, kind: "cod", redirectTo: `/orders/${created.order_number}?token=${accessToken}` };
  }

  if (input.payment_method === "phonepe") {
    try {
      const url = await startPhonePe({ id: created.order_id, order_number: created.order_number, total_paise: quote.totalPaise }, accessToken, settings.checkout.reservation_minutes);
      return { ok: true, kind: "redirect", url, orderNumber: created.order_number, accessToken };
    } catch (e) {
      logError("checkout.phonepe_order", e, { order: created.order_number });
      await admin.rpc("release_order", { p_order_id: created.order_id, p_new_status: "cancelled", p_reason: "Payment could not be started" });
      revalidateStorefront();
      return { ok: false, message: "We couldn't start the PhonePe payment. You have not been charged. Please try again or choose another way to pay." };
    }
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
    .select("id, order_number, user_id, status, payment_status, payment_method, payment_reference, total_paise, access_token_hash, customer_name, email, phone, reservation_expires_at")
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
  if (order.payment_method === "phonepe") {
    if (!getPhonePeEnv()) return { ok: false, message: "PhonePe payments are not available right now." };
    const settings = await getAllSettings();
    try {
      const url = await startPhonePe(order, token ?? "", settings.checkout.reservation_minutes);
      return { ok: true, kind: "redirect", url, orderNumber: order.order_number, accessToken: token ?? "" };
    } catch (e) {
      logError("checkout.phonepe_resume", e, { order: order.order_number });
      return { ok: false, message: "We couldn't start the PhonePe payment. Please try again in a moment." };
    }
  }
  if (order.payment_method !== "razorpay") return { ok: false, message: "This order isn't paid online." };
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
  if (order.payment_reference) {
    return { ok: false, message: "You've told us you paid by UPI, so we're checking your payment. Please contact us if you want to cancel." };
  }
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

/**
 * After paying to the shop's UPI ID, the customer enters the UPI transaction
 * reference (UTR, shown in their UPI app). The order is then held until the
 * shop has checked the payment — it does NOT count as paid yet.
 */
export async function submitUpiReferenceAction(orderNumber: string, token: string | null, reference: string): Promise<{ ok: boolean; message: string }> {
  if (!(await checkRateLimit("paymentVerify", await getClientIp()))) return { ok: false, message: "Too many attempts. Please wait a moment." };
  const ref = reference.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9]{6,35}$/.test(ref)) {
    return { ok: false, message: "Enter the UPI transaction ID (UTR) exactly as your UPI app shows it — usually 12 digits." };
  }
  const order = await authorizedPendingOrder(orderNumber, token);
  if (!order || order.payment_method !== "upi_manual") return { ok: false, message: "We couldn't find that order." };
  if (order.status !== "pending_payment") return { ok: false, message: "This order is no longer waiting for payment." };
  const admin = getServiceDb();
  if (!admin) return { ok: false, message: "Please try again." };
  const { error } = await admin
    .from("orders")
    .update({
      payment_reference: ref,
      // Keep the stock for this customer until the shop has checked the payment.
      reservation_expires_at: null,
      needs_attention: true,
      attention_reason: `Customer says they paid ₹${(order.total_paise / 100).toFixed(2)} by UPI (reference ${ref}). Check your UPI app, then confirm or cancel.`,
    })
    .eq("id", order.id)
    .eq("status", "pending_payment");
  if (error) {
    logError("checkout.upi_reference", error);
    return { ok: false, message: "We couldn't save that. Please try again." };
  }
  await admin.from("order_events").insert({
    order_id: order.id,
    type: "upi_reference",
    message: `UPI payment reference ${ref} received. We'll confirm your order once we've checked the payment.`,
    visibility: "customer",
  });
  return { ok: true, message: "Thank you! We'll confirm your order as soon as we've checked the payment — usually within a few hours." };
}

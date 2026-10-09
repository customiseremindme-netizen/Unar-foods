"use server";

import { z } from "zod";
import { getServiceDb } from "@/lib/db/client";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { normalizeIndianPhone } from "@/lib/validation/common";
import { orderStatusLabel } from "@/lib/orders/view";

export type TrackResult =
  | { ok: false; message: string }
  | {
      ok: true;
      order: {
        orderNumber: string;
        statusLabel: string;
        statusTone: "success" | "banana" | "danger" | "sage" | "muted";
        placedAt: string;
        items: { title: string; variant: string | null; quantity: number }[];
        shipments: { carrier: string | null; trackingNumber: string | null; trackingUrl: string | null; status: string }[];
        events: { message: string; at: string }[];
      };
    };

const schema = z.object({
  order_number: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^UNAR-\d{4,}$/, "Enter your order number, e.g. UNAR-001001"),
  contact: z.string().trim().min(5, "Enter the email or mobile number used for the order").max(254),
});

/**
 * Order lookup for customers without an account. Requires the order number
 * AND the email or phone used at checkout; shows status and tracking only
 * (never the address or payment details).
 */
export async function trackOrderAction(_prev: TrackResult | null, formData: FormData): Promise<TrackResult> {
  const parsed = schema.safeParse({ order_number: formData.get("order_number"), contact: formData.get("contact") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check your details." };
  if (!(await checkRateLimit("trackOrder", await getClientIp()))) {
    return { ok: false, message: "Too many attempts. Please wait a few minutes." };
  }
  const admin = getServiceDb();
  if (!admin) return { ok: false, message: "Order tracking is not available right now." };

  const { data: order } = await admin
    .from("orders")
    .select(
      "order_number, email, phone, status, payment_status, fulfillment_status, payment_method, placed_at, created_at, order_items ( title, variant_title, quantity ), shipments ( carrier, tracking_number, tracking_url, status ), order_events ( message, visibility, created_at )",
    )
    .eq("order_number", parsed.data.order_number)
    .maybeSingle();

  const contact = parsed.data.contact.toLowerCase();
  const matches =
    !!order && (order.email.toLowerCase() === contact || (/\d/.test(contact) && order.phone === normalizeIndianPhone(contact)));
  if (!order || !matches) {
    return { ok: false, message: "We couldn't find an order with those details. Please check and try again." };
  }

  const status = orderStatusLabel(order);
  return {
    ok: true,
    order: {
      orderNumber: order.order_number,
      statusLabel: status.label,
      statusTone: status.tone,
      placedAt: order.placed_at ?? order.created_at,
      items: (order.order_items ?? []).map((i) => ({ title: i.title, variant: i.variant_title, quantity: i.quantity })),
      shipments: (order.shipments ?? []).map((s) => ({
        carrier: s.carrier,
        trackingNumber: s.tracking_number,
        trackingUrl: s.tracking_url,
        status: s.status,
      })),
      events: (order.order_events ?? [])
        .filter((e) => e.visibility === "customer")
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((e) => ({ message: e.message, at: e.created_at })),
    },
  };
}

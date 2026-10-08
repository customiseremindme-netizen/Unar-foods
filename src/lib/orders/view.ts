import "server-only";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getSessionUser, getStaffAccess } from "@/lib/auth/session";
import { safeEqual, sha256Hex } from "@/lib/security/tokens";
import type { TaxBreakdown } from "@/lib/commerce/types";

export type OrderView = {
  id: string;
  order_number: string;
  user_id: string | null;
  email: string;
  phone: string;
  customer_name: string;
  shipping_address: Record<string, string>;
  billing_address: Record<string, string> | null;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  payment_method: string;
  subtotal_paise: number;
  discount_paise: number;
  shipping_paise: number;
  cod_fee_paise: number;
  tax_paise: number;
  prices_include_tax: boolean;
  tax_breakdown: TaxBreakdown | Record<string, never>;
  total_paise: number;
  refunded_paise: number;
  coupon_code: string | null;
  customer_note: string | null;
  reservation_expires_at: string | null;
  placed_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  items: {
    id: string;
    title: string;
    variant_title: string | null;
    sku: string | null;
    image_url: string | null;
    unit_price_paise: number;
    mrp_paise: number;
    quantity: number;
    line_total_paise: number;
    hsn_code: string | null;
    gst_rate: number | null;
    product_id: string | null;
  }[];
  events: { id: number; type: string; message: string; created_at: string }[];
  shipments: {
    id: string;
    carrier: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
    status: string;
    shipped_at: string | null;
    delivered_at: string | null;
    shipment_events: { id: number; status: string; description: string | null; location: string | null; occurred_at: string }[];
  }[];
};

const ORDER_SELECT = `
  id, order_number, user_id, email, phone, customer_name, shipping_address, billing_address, status, payment_status,
  fulfillment_status, payment_method, subtotal_paise, discount_paise, shipping_paise, cod_fee_paise, tax_paise,
  prices_include_tax, tax_breakdown, total_paise, refunded_paise, coupon_code, customer_note, reservation_expires_at,
  placed_at, paid_at, cancelled_at, cancel_reason, created_at, access_token_hash,
  order_items ( id, title, variant_title, sku, image_url, unit_price_paise, mrp_paise, quantity, line_total_paise, hsn_code, gst_rate, product_id ),
  order_events ( id, type, message, visibility, created_at ),
  shipments ( id, carrier, tracking_number, tracking_url, status, shipped_at, delivered_at,
    shipment_events ( id, status, description, location, occurred_at ) )
`;

/**
 * Returns an order ONLY to someone allowed to see it:
 * - the signed-in customer who placed it,
 * - anyone holding the private link token from the confirmation page/email,
 * - staff with order permissions (when allowStaff is true).
 * Otherwise returns null (we never reveal whether an order number exists).
 */
export async function getOrderForViewer(
  orderNumber: string,
  token: string | null,
  options: { allowStaff?: boolean } = {},
): Promise<OrderView | null> {
  if (!/^UNAR-\d{4,}$/.test(orderNumber)) return null;
  const admin = getAdminSupabase();
  if (!admin) return null;
  const { data } = await admin.from("orders").select(ORDER_SELECT).eq("order_number", orderNumber).maybeSingle();
  if (!data) return null;

  const user = await getSessionUser();
  const isOwner = !!user && data.user_id === user.id;
  const hasToken = !!token && token.length >= 20 && safeEqual(sha256Hex(token), data.access_token_hash);
  let isStaff = false;
  if (!isOwner && !hasToken && options.allowStaff) {
    isStaff = !!(await getStaffAccess())?.permissions.has("orders.read");
  }
  if (!isOwner && !hasToken && !isStaff) return null;

  const { access_token_hash: _hash, order_items, order_events, shipments, ...rest } = data as typeof data & {
    order_items: OrderView["items"];
    order_events: (OrderView["events"][number] & { visibility: string })[];
    shipments: OrderView["shipments"];
  };
  void _hash;
  return {
    ...(rest as unknown as Omit<OrderView, "items" | "events" | "shipments">),
    items: order_items ?? [],
    events: (order_events ?? [])
      .filter((e) => e.visibility === "customer")
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(({ id, type, message, created_at }) => ({ id, type, message, created_at })),
    shipments: (shipments ?? []).map((s) => ({
      ...s,
      shipment_events: [...(s.shipment_events ?? [])].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    })),
  };
}

export function orderStatusLabel(order: Pick<OrderView, "status" | "payment_status" | "fulfillment_status" | "payment_method">): {
  label: string;
  tone: "success" | "banana" | "danger" | "sage" | "muted";
} {
  if (order.status === "pending_payment") return { label: "Awaiting payment", tone: "banana" };
  if (order.status === "expired") return { label: "Expired — not paid", tone: "muted" };
  if (order.status === "payment_failed") return { label: "Payment failed", tone: "danger" };
  if (order.status === "cancelled") return { label: "Cancelled", tone: "muted" };
  if (order.payment_status === "refunded") return { label: "Refunded", tone: "muted" };
  switch (order.fulfillment_status) {
    case "delivered":
      return { label: "Delivered", tone: "success" };
    case "shipped":
      return { label: "Shipped", tone: "sage" };
    case "packed":
      return { label: "Packed", tone: "sage" };
    case "processing":
      return { label: "Processing", tone: "sage" };
    case "returned":
      return { label: "Returned", tone: "muted" };
    default:
      return { label: order.payment_method === "cod" ? "Confirmed — Cash on Delivery" : "Confirmed", tone: "success" };
  }
}

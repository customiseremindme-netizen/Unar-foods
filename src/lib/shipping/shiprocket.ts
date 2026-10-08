import "server-only";
import { getShiprocketEnv, type ShiprocketEnv } from "@/lib/env";

/**
 * Optional Shiprocket integration. It is only used when SHIPROCKET_EMAIL and
 * SHIPROCKET_PASSWORD (an API user created in Shiprocket → Settings → API)
 * are configured. Without them the dashboard uses manual tracking entries.
 */

export class ShiprocketError extends Error {}

let tokenCache: { token: string; expires: number } | null = null;

async function token(env: ShiprocketEnv): Promise<string> {
  if (tokenCache && tokenCache.expires > Date.now()) return tokenCache.token;
  const res = await fetch(`${env.apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.email, password: env.password }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
  if (!res.ok || !body.token) throw new ShiprocketError(body.message ?? `Shiprocket login failed (${res.status})`);
  // Shiprocket tokens are valid for 10 days; refresh after 9.
  tokenCache = { token: body.token, expires: Date.now() + 9 * 24 * 3600 * 1000 };
  return body.token;
}

async function call<T>(method: "GET" | "POST", path: string, payload?: unknown): Promise<T> {
  const env = getShiprocketEnv();
  if (!env) throw new ShiprocketError("Shiprocket is not configured");
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token(env)}` },
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const body = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new ShiprocketError((body as { message?: string }).message ?? `Shiprocket request failed (${res.status})`);
  return body;
}

export function isShiprocketConfigured() {
  return getShiprocketEnv() !== null;
}

export async function testShiprocketConnection(): Promise<{ ok: boolean; message: string }> {
  const env = getShiprocketEnv();
  if (!env) return { ok: false, message: "Shiprocket credentials are not set." };
  try {
    tokenCache = null;
    await token(env);
    return { ok: true, message: "Connected to Shiprocket successfully." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
  }
}

export type ShiprocketOrderInput = {
  orderNumber: string;
  orderDate: string;
  pickupLocation: string;
  customer: { name: string; email: string; phone: string };
  address: { line1: string; line2?: string; city: string; state: string; pincode: string };
  items: { name: string; sku: string; units: number; sellingPrice: number }[];
  paymentMethod: "Prepaid" | "COD";
  subTotal: number;
  shippingCharges: number;
  discount: number;
  weightKg: number;
  dimensionsCm: { length: number; breadth: number; height: number };
};

export async function createShiprocketOrder(input: ShiprocketOrderInput) {
  return call<{ order_id: number; shipment_id: number; status: string; awb_code?: string; courier_name?: string }>(
    "POST",
    "/orders/create/adhoc",
    {
      order_id: input.orderNumber,
      order_date: input.orderDate,
      pickup_location: input.pickupLocation,
      billing_customer_name: input.customer.name,
      billing_last_name: "",
      billing_address: input.address.line1,
      billing_address_2: input.address.line2 ?? "",
      billing_city: input.address.city,
      billing_pincode: input.address.pincode,
      billing_state: input.address.state,
      billing_country: "India",
      billing_email: input.customer.email,
      billing_phone: input.customer.phone,
      shipping_is_billing: true,
      order_items: input.items.map((i) => ({ name: i.name, sku: i.sku, units: i.units, selling_price: i.sellingPrice })),
      payment_method: input.paymentMethod,
      sub_total: input.subTotal,
      shipping_charges: input.shippingCharges,
      total_discount: input.discount,
      length: input.dimensionsCm.length,
      breadth: input.dimensionsCm.breadth,
      height: input.dimensionsCm.height,
      weight: input.weightKg,
    },
  );
}

export type ShiprocketTracking = {
  tracking_data?: {
    shipment_status?: number;
    track_url?: string;
    shipment_track?: { awb_code?: string; courier_name?: string; current_status?: string; delivered_date?: string }[];
    shipment_track_activities?: { date: string; activity: string; location: string; "sr-status-label"?: string }[];
  };
};

export async function trackShiprocketShipment(shipmentId: string) {
  return call<ShiprocketTracking>("GET", `/courier/track/shipment/${encodeURIComponent(shipmentId)}`);
}

"use server";

import { getPublicSettings } from "@/lib/settings";
import { loadActiveZones } from "@/lib/commerce/checkout";
import { quoteShipping } from "@/lib/commerce/shipping";
import { formatINR } from "@/lib/money";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";

export type DeliveryCheck = { ok: boolean; message: string; details?: string[] };

/**
 * "Check delivery" on the product page: tells a customer whether the shop
 * delivers to their PIN code, using the same shipping zones and rates as
 * checkout (Dashboard → Shipping). The final charge is always confirmed at checkout.
 */
export async function checkDeliveryAction(_prev: DeliveryCheck | null, formData: FormData): Promise<DeliveryCheck> {
  const pincode = String(formData.get("pincode") ?? "").trim();
  if (!/^[1-9]\d{5}$/.test(pincode)) return { ok: false, message: "Enter a valid 6-digit PIN code." };
  if (!(await checkRateLimit("deliveryCheck", await getClientIp()))) return { ok: false, message: "Too many checks. Please try again in a few minutes." };

  const [settings, zones] = await Promise.all([getPublicSettings(), loadActiveZones()]);
  const quote = quoteShipping({
    zones,
    shippingEnabled: settings.shipping.enabled && zones.length > 0,
    blockedPincodes: settings.shipping.blocked_pincodes,
    destination: { pincode },
    weightGrams: 100 + settings.shipping.packaging_weight_grams,
    subtotalAfterDiscountPaise: 0,
    freeShipping: false,
  });
  if (quote.status === "disabled") return { ok: false, message: "Delivery details will be confirmed at checkout." };
  if (quote.status === "unserviceable") {
    // Zones by state need the full address, which we only have at checkout.
    if (zones.some((z) => z.match_type === "states")) return { ok: true, message: "Enter your full address at checkout to see delivery options for this PIN code." };
    return { ok: false, message: quote.reason };
  }
  if (quote.status !== "ok") return { ok: false, message: "Delivery details will be confirmed at checkout." };
  const details = [
    quote.isFree ? "Free delivery" : `Delivery from ${formatINR(quote.paise)} for one pack`,
    quote.freeShippingThresholdPaise ? `Free delivery on orders of ${formatINR(quote.freeShippingThresholdPaise)} or more` : null,
    quote.deliveryEstimate ? `Estimated delivery: ${quote.deliveryEstimate}` : null,
    quote.codAvailable && settings.checkout.cod_enabled ? "Cash on delivery available" : null,
  ].filter((d): d is string => !!d);
  return { ok: true, message: `Good news — we deliver to ${pincode}.`, details };
}

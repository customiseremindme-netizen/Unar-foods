import type { ShippingQuote, ShippingZone } from "./types";

const SPECIFICITY: Record<string, number> = { pincode_prefixes: 0, states: 1, all: 2 };

function zoneMatches(zone: ShippingZone, pincode: string | undefined, state: string | undefined): boolean {
  if (zone.match_type === "all") return true;
  if (zone.match_type === "pincode_prefixes") {
    if (!pincode) return false;
    return zone.pincode_prefixes.some((prefix) => prefix.trim() !== "" && pincode.startsWith(prefix.trim()));
  }
  if (zone.match_type === "states") {
    if (!state) return false;
    const s = state.trim().toLowerCase();
    return zone.states.some((zs) => zs.trim().toLowerCase() === s);
  }
  return false;
}

/** Most specific active zone wins (PIN prefix → state → all India), then sort order. */
export function findShippingZone(
  zones: ShippingZone[],
  destination: { pincode?: string; state?: string },
): ShippingZone | null {
  const candidates = zones
    .filter((z) => z.is_active && zoneMatches(z, destination.pincode, destination.state))
    .sort(
      (a, b) =>
        (SPECIFICITY[a.match_type] ?? 9) - (SPECIFICITY[b.match_type] ?? 9) || a.sort_order - b.sort_order,
    );
  return candidates[0] ?? null;
}

export function calculateShippingPaise(
  zone: ShippingZone,
  input: { weightGrams: number; subtotalAfterDiscountPaise: number; freeShipping: boolean },
): { paise: number; isFree: boolean } {
  if (input.freeShipping) return { paise: 0, isFree: true };
  if (
    zone.free_shipping_threshold_paise !== null &&
    input.subtotalAfterDiscountPaise >= zone.free_shipping_threshold_paise
  ) {
    return { paise: 0, isFree: true };
  }
  if (zone.rate_type === "weight") {
    const extra = Math.max(0, input.weightGrams - zone.base_weight_grams);
    const steps = Math.ceil(extra / Math.max(1, zone.additional_weight_step_grams));
    const paise = zone.base_rate_paise + steps * zone.additional_rate_paise;
    return { paise, isFree: paise === 0 };
  }
  return { paise: zone.flat_rate_paise, isFree: zone.flat_rate_paise === 0 };
}

export function quoteShipping(input: {
  zones: ShippingZone[];
  shippingEnabled: boolean;
  blockedPincodes: string[];
  destination: { pincode?: string; state?: string } | null;
  weightGrams: number;
  subtotalAfterDiscountPaise: number;
  freeShipping: boolean;
}): ShippingQuote {
  if (!input.shippingEnabled) return { status: "disabled" };
  if (!input.destination || (!input.destination.pincode && !input.destination.state)) {
    return { status: "pending_address" };
  }
  if (input.destination.pincode && input.blockedPincodes.includes(input.destination.pincode)) {
    return { status: "unserviceable", reason: "Sorry, we don't deliver to this PIN code yet." };
  }
  const zone = findShippingZone(input.zones, input.destination);
  if (!zone) {
    return { status: "unserviceable", reason: "Sorry, we don't deliver to this location yet." };
  }
  const cost = calculateShippingPaise(zone, input);
  return {
    status: "ok",
    zoneId: zone.id,
    zoneName: zone.name,
    paise: cost.paise,
    isFree: cost.isFree,
    deliveryEstimate: zone.delivery_estimate?.trim() ? zone.delivery_estimate.trim() : null,
    codAvailable: zone.cod_available,
    freeShippingThresholdPaise: zone.free_shipping_threshold_paise,
  };
}

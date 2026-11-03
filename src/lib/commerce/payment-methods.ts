import "server-only";
import { getPhonePeEnv, getRazorpayEnv } from "@/lib/env";
import { getAllSettings } from "@/lib/settings";
import type { PaymentMethod } from "./types";

/** Which ways to pay are switched on and fully set up right now. */
export async function availablePaymentMethods(settings?: { checkout: Awaited<ReturnType<typeof getAllSettings>>["checkout"] }): Promise<PaymentMethod[]> {
  const s = settings ?? (await getAllSettings());
  const methods: PaymentMethod[] = [];
  if (s.checkout.online_payments_enabled && getRazorpayEnv()) methods.push("razorpay");
  if (s.checkout.phonepe_enabled && getPhonePeEnv()) methods.push("phonepe");
  if (s.checkout.upi_enabled && s.checkout.upi_id) methods.push("upi_manual");
  if (s.checkout.cod_enabled) methods.push("cod");
  return methods;
}


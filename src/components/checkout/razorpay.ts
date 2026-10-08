"use client";

import type { RazorpayCheckoutOptions } from "@/app/actions/checkout";

type RazorpaySuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayFailure = { error?: { description?: string; reason?: string } };

type RazorpayInstance = { open: () => void; on: (event: string, handler: (r: RazorpayFailure) => void) => void };
type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<boolean> | null = null;

export function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(!!window.Razorpay);
    script.onerror = () => {
      loading = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return loading;
}

export type VerifyResponse = { status: "paid" | "pending" | "failed" | "invalid"; redirectTo: string };

/**
 * Opens the Razorpay payment window. Resolves when the customer pays (after
 * server-side verification), dismisses the window, or the payment fails.
 */
export async function payWithRazorpay(
  options: RazorpayCheckoutOptions,
  themeColor: string,
): Promise<{ outcome: "verified"; verify: VerifyResponse } | { outcome: "dismissed" } | { outcome: "failed"; message: string } | { outcome: "unavailable" }> {
  const ok = await loadRazorpay();
  if (!ok || !window.Razorpay) return { outcome: "unavailable" };

  return new Promise((resolve) => {
    let settled = false;
    const done = (value: Parameters<typeof resolve>[0]) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const rzp = new window.Razorpay!({
      key: options.keyId,
      order_id: options.razorpayOrderId,
      amount: options.amountPaise,
      currency: options.currency,
      name: options.name,
      description: options.description,
      prefill: options.prefill,
      notes: { order_number: options.orderNumber },
      theme: { color: themeColor },
      retry: { enabled: true, max_count: 3 },
      modal: {
        confirm_close: true,
        ondismiss: () => done({ outcome: "dismissed" }),
      },
      handler: async (response: RazorpaySuccess) => {
        try {
          const res = await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, order_number: options.orderNumber, token: options.accessToken || undefined }),
          });
          const verify = (await res.json()) as VerifyResponse;
          done({ outcome: "verified", verify });
        } catch {
          // Network problem after paying: the webhook will still confirm it.
          done({
            outcome: "verified",
            verify: {
              status: "pending",
              redirectTo: `/orders/${options.orderNumber}${options.accessToken ? `?token=${encodeURIComponent(options.accessToken)}` : ""}`,
            },
          });
        }
      },
    });
    rzp.on("payment.failed", (response) => {
      // Razorpay lets the customer retry inside the window; we only record the message.
      const message = response.error?.description ?? "Payment failed.";
      window.dispatchEvent(new CustomEvent("unar:payment-failed", { detail: message }));
    });
    rzp.open();
  });
}

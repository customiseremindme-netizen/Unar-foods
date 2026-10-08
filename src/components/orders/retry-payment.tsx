"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cancelPendingOrderAction, resumePaymentAction } from "@/app/actions/checkout";
import { payWithRazorpay } from "@/components/checkout/razorpay";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";

export function RetryPayment({ orderNumber, token }: { orderNumber: string; token: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Payment may be confirmed by the webhook a moment after the redirect.
  useEffect(() => {
    const t = window.setTimeout(() => router.refresh(), 6000);
    return () => window.clearTimeout(t);
  }, [router]);

  return (
    <div className="mt-4 space-y-3">
      {message ? <FormMessage tone="info">{message}</FormMessage> : null}
      <div className="flex flex-wrap gap-3">
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setMessage(null);
            const result = await resumePaymentAction(orderNumber, token);
            if (!result.ok) {
              setMessage(result.message);
              setBusy(false);
              return;
            }
            if (result.kind === "razorpay") {
              const outcome = await payWithRazorpay(result.razorpay, "#2E4E36");
              if (outcome.outcome === "verified") router.refresh();
              else if (outcome.outcome === "unavailable") setMessage("The payment window couldn't load. Please try again.");
            }
            setBusy(false);
          }}
        >
          Complete payment
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            const r = await cancelPendingOrderAction(orderNumber, token);
            setMessage(r.message);
            router.refresh();
          }}
        >
          Cancel order
        </Button>
      </div>
    </div>
  );
}

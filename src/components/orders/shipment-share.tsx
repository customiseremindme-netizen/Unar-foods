"use client";

import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shares courier details only, never a private order token, address or customer email. */
export function ShipmentShare({ carrier, trackingNumber, trackingUrl }: { carrier: string | null; trackingNumber: string | null; trackingUrl: string | null }) {
  const [message, setMessage] = useState("");
  const text = [carrier || "Courier", trackingNumber ? `Tracking number: ${trackingNumber}` : "", trackingUrl || ""].filter(Boolean).join("\n");
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage("Copied."); }
    catch { setMessage("Copy is unavailable in this browser. Select the tracking details above to copy them."); }
  }
  return <div className="mt-3">
    <div className="flex flex-wrap gap-2">
      {trackingNumber ? <Button type="button" size="sm" variant="secondary" onClick={() => copy(trackingNumber)}><Copy className="size-3.5" aria-hidden="true" /> Copy tracking number</Button> : null}
      <Button type="button" size="sm" variant="secondary" onClick={async () => {
        if (!navigator.share) return copy(text);
        try { await navigator.share({ title: "UNAR shipment tracking", text }); setMessage("Tracking shared."); }
        catch (error) { if ((error as Error).name !== "AbortError") setMessage("Sharing is unavailable. Use Copy tracking number."); }
      }}><Share2 className="size-3.5" aria-hidden="true" /> Share tracking</Button>
    </div>
    {message ? <p role="status" className="mt-2 text-[0.8rem] text-muted">{message}</p> : null}
  </div>;
}

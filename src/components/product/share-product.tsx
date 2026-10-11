"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

export function ShareProduct({ title }: { title: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function share() {
    setBusy(true);
    setMessage("");
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    try {
      if (navigator.share) await navigator.share({ title, url: url.toString() });
      else { await navigator.clipboard.writeText(url.toString()); setMessage("Product link copied."); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("Copy the address from your browser to share this product.");
    } finally { setBusy(false); }
  }
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 text-[0.85rem]">
      <button type="button" onClick={share} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-forest transition-colors hover:border-forest disabled:opacity-50"><Share2 className="size-4" aria-hidden="true" />Share product</button>
      <span role="status">{message}</span>
    </div>
  );
}

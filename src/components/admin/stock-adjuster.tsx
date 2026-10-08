"use client";

import { useState } from "react";
import { adjustStockAction } from "@/app/admin/_actions/store-ops";
import { Button } from "@/components/ui/button";
import { AdminForm } from "./forms";
import { smallInput } from "./ui";

/** Compact “add / remove / set” stock form used on each inventory row. */
export function StockAdjuster({ variantId, current }: { variantId: string; current: number }) {
  const [mode, setMode] = useState<"add" | "remove" | "set">("add");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Update stock
      </Button>
    );
  }
  const id = `stock-${variantId}`;
  return (
    <AdminForm action={adjustStockAction} onSuccess={() => setOpen(false)} className="grid gap-2 text-[0.78rem]">
      <input type="hidden" name="variant_id" value={variantId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-muted">
          Action
          <select name="mode" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={`${smallInput} mt-1 block`}>
            <option value="add">Add</option>
            <option value="remove">Remove</option>
            <option value="set">Set to</option>
          </select>
        </label>
        <label className="text-muted" htmlFor={`${id}-qty`}>
          Quantity
          <input key={mode} id={`${id}-qty`} name="quantity" type="number" min={0} required defaultValue={mode === "set" ? current : ""} className={`${smallInput} mt-1 block w-24`} />
        </label>
        <label className="text-muted">
          Reason
          <select name="reason" defaultValue="restock" className={`${smallInput} mt-1 block`}>
            <option value="restock">New stock received</option>
            <option value="initial">Opening stock</option>
            <option value="correction">Count correction</option>
            <option value="damage">Damaged / expired</option>
            <option value="return_restock">Customer return</option>
            <option value="adjustment">Other adjustment</option>
          </select>
        </label>
      </div>
      <label className="text-muted">
        Note (optional)
        <input name="note" maxLength={300} placeholder="e.g. Batch 12, invoice 345" className={`${smallInput} mt-1 block w-full`} />
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </AdminForm>
  );
}

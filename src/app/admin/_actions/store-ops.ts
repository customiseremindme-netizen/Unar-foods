"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { check, runAdminAction, UserFacingError, type ActionResult } from "@/lib/admin/action";
import { logAdminAction } from "@/lib/audit";
import { revalidateStorefront } from "@/lib/cache";

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
const stockSchema = z.object({
  variant_id: z.uuid(),
  mode: z.enum(["add", "remove", "set"]),
  quantity: z.coerce.number().int("Whole numbers only").min(0, "Enter 0 or more").max(1_000_000),
  reason: z.enum(["initial", "restock", "adjustment", "correction", "damage", "return_restock"]),
  note: z.string().trim().max(300).optional(),
});

const STOCK_ERRORS: Record<string, string> = {
  NEGATIVE_STOCK: "Stock can't go below zero.",
  ZERO_DELTA: "Nothing to change — the stock is already at that number.",
  VARIANT_NOT_FOUND: "This product size no longer exists.",
};

export async function adjustStockAction(formData: FormData): Promise<ActionResult<number>> {
  return runAdminAction("inventory.write", async ({ db }) => {
    const s = stockSchema.parse({
      variant_id: formData.get("variant_id"),
      mode: formData.get("mode"),
      quantity: formData.get("quantity"),
      reason: formData.get("reason"),
      note: formData.get("note") ?? "",
    });
    const { data: variant } = check(await db.from("product_variants").select("stock, sku").eq("id", s.variant_id).single());
    const delta = s.mode === "add" ? s.quantity : s.mode === "remove" ? -s.quantity : s.quantity - variant!.stock;
    const { data: stock, error } = await db.rpc("adjust_stock", {
      p_variant_id: s.variant_id,
      p_delta: delta,
      p_reason: s.reason,
      p_note: s.note ?? "",
    });
    if (error) {
      const key = Object.keys(STOCK_ERRORS).find((k) => error.message.includes(k));
      throw new UserFacingError(key ? STOCK_ERRORS[key] : "Could not update stock.");
    }
    await logAdminAction({
      action: "inventory.adjust",
      entityType: "variant",
      entityId: s.variant_id,
      summary: `${variant!.sku}: ${delta > 0 ? "+" : ""}${delta} (${s.reason}) → ${stock}`,
    });
    revalidateStorefront();
    revalidatePath("/admin/inventory");
    return { ok: true, message: `Stock for ${variant!.sku} is now ${stock}.`, data: stock as number };
  });
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
export async function setReviewStatusAction(id: string, status: "approved" | "rejected" | "spam" | "pending"): Promise<ActionResult> {
  return runAdminAction("reviews.moderate", async ({ db }) => {
    z.uuid().parse(id);
    z.enum(["approved", "rejected", "spam", "pending"]).parse(status);
    check(
      await db
        .from("reviews")
        .update({ status, approved_at: status === "approved" ? new Date().toISOString() : null })
        .eq("id", id),
    );
    await logAdminAction({ action: "review.moderate", entityType: "review", entityId: id, summary: `Review marked ${status}` });
    revalidateStorefront();
    revalidatePath("/admin/reviews");
    return { ok: true, message: status === "approved" ? "Review approved and shown on the product page." : `Review marked as ${status}.` };
  });
}

export async function replyToReviewAction(formData: FormData): Promise<ActionResult> {
  return runAdminAction("reviews.moderate", async ({ db }) => {
    const { id, reply } = z
      .object({ id: z.uuid(), reply: z.string().trim().max(1000, "Keep the reply under 1000 characters") })
      .parse({ id: formData.get("id"), reply: formData.get("reply") ?? "" });
    check(await db.from("reviews").update({ admin_reply: reply || null }).eq("id", id));
    await logAdminAction({ action: "review.reply", entityType: "review", entityId: id, summary: reply ? "Replied to a review" : "Removed review reply" });
    revalidateStorefront();
    revalidatePath("/admin/reviews");
    return { ok: true, message: reply ? "Reply saved." : "Reply removed." };
  });
}

export async function deleteReviewAction(id: string): Promise<ActionResult> {
  return runAdminAction("reviews.moderate", async ({ db }) => {
    z.uuid().parse(id);
    check(await db.from("reviews").delete().eq("id", id));
    await logAdminAction({ action: "review.delete", entityType: "review", entityId: id, summary: "Deleted a review" });
    revalidateStorefront();
    revalidatePath("/admin/reviews");
    return { ok: true, message: "Review deleted." };
  });
}

// ---------------------------------------------------------------------------
// Contact messages
// ---------------------------------------------------------------------------
export async function setMessageStatusAction(id: string, status: "new" | "read" | "archived"): Promise<ActionResult> {
  return runAdminAction("customers.read", async ({ db }) => {
    z.uuid().parse(id);
    z.enum(["new", "read", "archived"]).parse(status);
    check(await db.from("contact_messages").update({ status }).eq("id", id));
    revalidatePath("/admin/messages");
    return { ok: true, message: null };
  });
}

export async function deleteMessageAction(id: string): Promise<ActionResult> {
  return runAdminAction("customers.read", async ({ db }) => {
    z.uuid().parse(id);
    check(await db.from("contact_messages").delete().eq("id", id));
    await logAdminAction({ action: "message.delete", entityType: "contact_message", entityId: id, summary: "Deleted a contact message" });
    revalidatePath("/admin/messages");
    return { ok: true, message: "Message deleted." };
  });
}

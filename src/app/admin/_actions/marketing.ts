"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { check, runAdminAction, UserFacingError, type ActionResult } from "@/lib/admin/action";
import { logAdminAction } from "@/lib/audit";
import { revalidateStorefront } from "@/lib/cache";
import { rupeesToPaise } from "@/lib/money";
import { INDIAN_STATES } from "@/lib/validation/common";

const emptyToUndef = z.literal("").transform(() => undefined);

/** "" → null, otherwise rupees → paise (validated). */
const optionalRupees = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const paise = rupeesToPaise(v);
    if (paise === null || paise < 0) {
      ctx.addIssue({ code: "custom", message: "Enter an amount in rupees, e.g. 499" });
      return z.NEVER;
    }
    return paise;
  });

const optionalInt = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) {
      ctx.addIssue({ code: "custom", message: "Enter a whole number of 1 or more" });
      return z.NEVER;
    }
    return n;
  });

const istDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(`${v}:00+05:30`).toISOString() : null));

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------
const couponSchema = z
  .object({
    id: z.uuid().optional().or(emptyToUndef),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,32}$/, "3–32 letters or numbers, no spaces"),
    description: z.string().trim().max(200).optional(),
    discount_type: z.enum(["percent", "fixed", "free_shipping"]),
    value: z.string().trim().optional(),
    min_subtotal: optionalRupees,
    max_discount: optionalRupees,
    usage_limit: optionalInt,
    per_customer_limit: optionalInt,
    starts_at: istDate,
    ends_at: istDate,
    is_active: z.boolean(),
  })
  .refine((c) => !c.starts_at || !c.ends_at || c.ends_at > c.starts_at, { path: ["ends_at"], message: "End must be after start" });

export async function saveCouponAction(formData: FormData): Promise<ActionResult> {
  return runAdminAction("marketing.write", async ({ supabase }) => {
    const raw = Object.fromEntries(formData) as Record<string, string>;
    const c = couponSchema.parse({ ...raw, is_active: raw.is_active === "on" });
    let discount_value = 0;
    if (c.discount_type === "percent") {
      const pct = Number(c.value);
      if (!Number.isInteger(pct) || pct < 1 || pct > 100) throw new UserFacingError("Percentage must be a whole number from 1 to 100.");
      discount_value = pct;
    } else if (c.discount_type === "fixed") {
      const paise = rupeesToPaise(c.value ?? "");
      if (!paise || paise <= 0) throw new UserFacingError("Enter the discount amount in rupees.");
      discount_value = paise;
    }
    const row = {
      code: c.code,
      description: c.description || null,
      discount_type: c.discount_type,
      discount_value,
      min_subtotal_paise: c.min_subtotal ?? 0,
      max_discount_paise: c.discount_type === "percent" ? c.max_discount : null,
      usage_limit: c.usage_limit,
      per_customer_limit: c.per_customer_limit,
      starts_at: c.starts_at,
      ends_at: c.ends_at,
      is_active: c.is_active,
    };
    if (c.id) check(await supabase.from("coupons").update(row).eq("id", c.id), "Could not save. Is the code already used?");
    else check(await supabase.from("coupons").insert(row), "Could not save. Is the code already used?");
    await logAdminAction({ action: "coupon.save", entityType: "coupon", entityId: c.id ?? null, summary: `Saved coupon ${c.code}` });
    revalidatePath("/admin/marketing/coupons");
    return { ok: true, message: `Coupon ${c.code} saved.` };
  });
}

export async function deleteCouponAction(id: string): Promise<ActionResult> {
  return runAdminAction("marketing.write", async ({ supabase }) => {
    z.uuid().parse(id);
    const { count } = await supabase.from("coupon_usages").select("id", { count: "exact", head: true }).eq("coupon_id", id);
    if (count) {
      // Keep history: switch it off instead.
      check(await supabase.from("coupons").update({ is_active: false }).eq("id", id));
      return { ok: true, message: "This coupon has been used, so it was switched off instead of deleted (keeps your records)." };
    }
    check(await supabase.from("coupons").delete().eq("id", id));
    await logAdminAction({ action: "coupon.delete", entityType: "coupon", entityId: id, summary: "Deleted a coupon" });
    revalidatePath("/admin/marketing/coupons");
    return { ok: true, message: "Coupon deleted." };
  });
}

// ---------------------------------------------------------------------------
// Newsletter subscribers
// ---------------------------------------------------------------------------
export async function unsubscribeSubscriberAction(id: string): Promise<ActionResult> {
  return runAdminAction("marketing.write", async ({ supabase }) => {
    z.uuid().parse(id);
    check(await supabase.from("subscribers").update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() }).eq("id", id));
    await logAdminAction({ action: "subscriber.unsubscribe", entityType: "subscriber", entityId: id, summary: "Unsubscribed a newsletter subscriber" });
    revalidatePath("/admin/marketing/subscribers");
    return { ok: true, message: "Unsubscribed." };
  });
}

export async function deleteSubscriberAction(id: string): Promise<ActionResult> {
  return runAdminAction("marketing.write", async ({ supabase }) => {
    z.uuid().parse(id);
    check(await supabase.from("subscribers").delete().eq("id", id));
    await logAdminAction({ action: "subscriber.delete", entityType: "subscriber", entityId: id, summary: "Deleted a subscriber (data removal)" });
    revalidatePath("/admin/marketing/subscribers");
    return { ok: true, message: "Subscriber deleted." };
  });
}

// ---------------------------------------------------------------------------
// Shipping zones
// ---------------------------------------------------------------------------
const zoneSchema = z
  .object({
    id: z.uuid().optional().or(emptyToUndef),
    name: z.string().trim().min(1, "Enter a name").max(80),
    is_active: z.boolean(),
    sort_order: z.coerce.number().int().min(0).max(9999),
    match_type: z.enum(["all", "states", "pincode_prefixes"]),
    states: z.array(z.enum(INDIAN_STATES as unknown as [string, ...string[]])).max(40),
    pincode_prefixes: z
      .string()
      .optional()
      .transform((v) =>
        (v ?? "")
          .split(/[\s,]+/)
          .map((x) => x.trim())
          .filter(Boolean),
      )
      .refine((list) => list.every((p) => /^[1-9]\d{0,5}$/.test(p)), "PIN prefixes must be 1–6 digits, e.g. 641 or 6416"),
    rate_type: z.enum(["flat", "weight"]),
    flat_rate: optionalRupees,
    base_weight_grams: z.coerce.number().int().min(1).max(100000),
    base_rate: optionalRupees,
    additional_weight_step_grams: z.coerce.number().int().min(1).max(100000),
    additional_rate: optionalRupees,
    free_shipping_threshold: optionalRupees,
    cod_available: z.boolean(),
    delivery_estimate: z.string().trim().max(80).optional(),
    notes: z.string().trim().max(300).optional(),
  })
  .refine((z) => z.match_type !== "states" || z.states.length > 0, { path: ["states"], message: "Choose at least one state" })
  .refine((z) => z.match_type !== "pincode_prefixes" || z.pincode_prefixes.length > 0, { path: ["pincode_prefixes"], message: "Enter at least one PIN prefix" });

export async function saveZoneAction(formData: FormData): Promise<ActionResult> {
  return runAdminAction("shipping.write", async ({ supabase }) => {
    const raw = Object.fromEntries(formData) as Record<string, string>;
    const zn = zoneSchema.parse({
      ...raw,
      states: formData.getAll("states").map(String),
      is_active: raw.is_active === "on",
      cod_available: raw.cod_available === "on",
    });
    const row = {
      name: zn.name,
      is_active: zn.is_active,
      sort_order: zn.sort_order,
      match_type: zn.match_type,
      states: zn.match_type === "states" ? zn.states : [],
      pincode_prefixes: zn.match_type === "pincode_prefixes" ? zn.pincode_prefixes : [],
      rate_type: zn.rate_type,
      flat_rate_paise: zn.flat_rate ?? 0,
      base_weight_grams: zn.base_weight_grams,
      base_rate_paise: zn.base_rate ?? 0,
      additional_weight_step_grams: zn.additional_weight_step_grams,
      additional_rate_paise: zn.additional_rate ?? 0,
      free_shipping_threshold_paise: zn.free_shipping_threshold,
      cod_available: zn.cod_available,
      delivery_estimate: zn.delivery_estimate || null,
      notes: zn.notes || null,
    };
    if (zn.id) check(await supabase.from("shipping_zones").update(row).eq("id", zn.id));
    else check(await supabase.from("shipping_zones").insert(row));
    await logAdminAction({ action: "shipping.zone.save", entityType: "shipping_zone", entityId: zn.id ?? null, summary: `Saved shipping zone “${zn.name}”${zn.is_active ? "" : " (inactive)"}` });
    revalidateStorefront();
    revalidatePath("/admin/shipping");
    return { ok: true, message: "Shipping zone saved." };
  });
}

export async function deleteZoneAction(id: string): Promise<ActionResult> {
  return runAdminAction("shipping.write", async ({ supabase }) => {
    z.uuid().parse(id);
    check(await supabase.from("shipping_zones").delete().eq("id", id));
    await logAdminAction({ action: "shipping.zone.delete", entityType: "shipping_zone", entityId: id, summary: "Deleted a shipping zone" });
    revalidateStorefront();
    revalidatePath("/admin/shipping");
    return { ok: true, message: "Shipping zone deleted." };
  });
}

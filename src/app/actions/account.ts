"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserDb } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { addressSchema, nameSchema, phoneSchema, toFieldErrors } from "@/lib/validation/common";
import { logError } from "@/lib/monitoring";
import type { FormState } from "./engagement";

async function requireSession() {
  const user = await getSessionUser();
  const db = await getUserDb();
  if (!user || !db) return null;
  return { user, db };
}

const profileSchema = z.object({
  full_name: nameSchema,
  phone: z.union([phoneSchema, z.literal("")]),
  marketing_consent: z.boolean(),
});

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  if (!session) return { ok: false, message: "Please sign in again." };
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: String(formData.get("phone") ?? "").trim(),
    marketing_consent: formData.get("marketing_consent") === "on",
  });
  if (!parsed.success) return { ok: false, message: null, errors: toFieldErrors(parsed.error) };
  const { error } = await session.db
    .from("profiles")
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone || null, marketing_consent: parsed.data.marketing_consent })
    .eq("id", session.user.id);
  if (error) {
    logError("account.profile", error);
    return { ok: false, message: "We couldn't save your details. Please try again." };
  }
  revalidatePath("/account", "layout");
  return { ok: true, message: "Your details have been saved." };
}

const addressFormSchema = addressSchema.extend({
  label: z.string().trim().max(40).optional().transform((v) => v || undefined),
  is_default: z.boolean(),
});

export async function saveAddressAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  if (!session) return { ok: false, message: "Please sign in again." };
  const id = String(formData.get("id") ?? "");
  const parsed = addressFormSchema.safeParse({
    label: formData.get("label") ?? "",
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    line1: formData.get("line1"),
    line2: formData.get("line2") ?? "",
    landmark: formData.get("landmark") ?? "",
    city: formData.get("city"),
    state: formData.get("state"),
    pincode: formData.get("pincode"),
    is_default: formData.get("is_default") === "on",
  });
  if (!parsed.success) return { ok: false, message: null, errors: toFieldErrors(parsed.error) };
  const { db, user } = session;
  const record = {
    label: parsed.data.label ?? null,
    full_name: parsed.data.full_name,
    phone: parsed.data.phone,
    line1: parsed.data.line1,
    line2: parsed.data.line2 ?? null,
    landmark: parsed.data.landmark ?? null,
    city: parsed.data.city,
    state: parsed.data.state,
    pincode: parsed.data.pincode,
    is_default: parsed.data.is_default,
  };
  if (parsed.data.is_default) {
    await db.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  }
  // Row level security guarantees a customer can only touch their own addresses.
  const { error } = /^[0-9a-f-]{36}$/.test(id)
    ? await db.from("addresses").update(record).eq("id", id).eq("user_id", user.id)
    : await db.from("addresses").insert({ ...record, user_id: user.id });
  if (error) {
    logError("account.address", error);
    return { ok: false, message: "We couldn't save this address. Please try again." };
  }
  revalidatePath("/account/addresses");
  return { ok: true, message: "Address saved." };
}

export async function deleteAddressAction(formData: FormData) {
  const session = await requireSession();
  if (!session) return;
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await session.db.from("addresses").delete().eq("id", id).eq("user_id", session.user.id);
  revalidatePath("/account/addresses");
}

export async function setDefaultAddressAction(formData: FormData) {
  const session = await requireSession();
  if (!session) return;
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await session.db.from("addresses").update({ is_default: false }).eq("user_id", session.user.id);
  await session.db.from("addresses").update({ is_default: true }).eq("id", id).eq("user_id", session.user.id);
  revalidatePath("/account/addresses");
}

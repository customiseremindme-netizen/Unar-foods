"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { RowDataPacket } from "mysql2/promise";
import { normalizeEmail, startSession } from "@/lib/auth/accounts";
import { hashPassword } from "@/lib/auth/password";
import { getReadyPool } from "@/lib/db/install";
import { withTransaction } from "@/lib/db/pool";
import { toSqlDateTime } from "@/lib/db/values";
import { getSetupKey } from "@/lib/env";
import { logError } from "@/lib/monitoring";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { safeEqual } from "@/lib/security/tokens";
import { emailSchema, nameSchema, passwordSchema, toFieldErrors } from "@/lib/validation/common";
import type { FormState } from "./engagement";

const schema = z
  .object({
    setup_key: z.string().min(1, "Enter the setup key").max(500),
    full_name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

/** Is there an owner yet? (null if the database can't be reached) */
export async function ownerExists(): Promise<boolean | null> {
  try {
    const pool = await getReadyPool();
    const [rows] = await pool.query<RowDataPacket[]>("SELECT 1 FROM staff_members WHERE role = 'owner' LIMIT 1");
    return rows.length > 0;
  } catch (error) {
    logError("setup.check", error);
    return null;
  }
}

/**
 * Creates the store owner's account the very first time (only while no owner
 * exists, and only with the SETUP_KEY from the hosting settings).
 */
export async function setupOwnerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = schema.safeParse({
    setup_key: formData.get("setup_key"),
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { ok: false, message: null, errors: toFieldErrors(parsed.error) };
  if (!(await checkRateLimit("setup", await getClientIp()))) {
    return { ok: false, message: "Too many attempts. Please wait an hour and try again." };
  }
  const key = getSetupKey();
  if (!key) return { ok: false, message: "Add SETUP_KEY in Hostinger first (at least 12 characters), redeploy, then reload this page." };
  if (!safeEqual(parsed.data.setup_key.trim(), key)) {
    return { ok: false, message: null, errors: { setup_key: "That setup key doesn't match the one saved in Hostinger." } };
  }

  let userId: string;
  try {
    const pool = await getReadyPool();
    const email = normalizeEmail(parsed.data.email);
    const hash = await hashPassword(parsed.data.password);
    const now = toSqlDateTime(new Date());
    userId = await withTransaction(pool, async (conn) => {
      const [owners] = await conn.query<RowDataPacket[]>("SELECT user_id FROM staff_members WHERE role = 'owner' LIMIT 1 FOR UPDATE");
      if (owners.length) throw new Error("OWNER_EXISTS");
      const [users] = await conn.query<RowDataPacket[]>("SELECT id FROM auth_users WHERE email = ? FOR UPDATE", [email]);
      let id = users[0]?.id as string | undefined;
      if (id) {
        // The owner already made a customer account with this email: use it.
        await conn.query("UPDATE auth_users SET password_hash = ?, email_confirmed_at = COALESCE(email_confirmed_at, ?) WHERE id = ?", [hash, now, id]);
        await conn.query("UPDATE profiles SET full_name = COALESCE(full_name, ?) WHERE id = ?", [parsed.data.full_name, id]);
      } else {
        id = randomUUID();
        await conn.query("INSERT INTO auth_users (id, email, password_hash, email_confirmed_at) VALUES (?, ?, ?, ?)", [id, email, hash, now]);
        await conn.query("INSERT INTO profiles (id, email, full_name) VALUES (?, ?, ?)", [id, email, parsed.data.full_name]);
      }
      await conn.query("INSERT INTO staff_members (user_id, role) VALUES (?, 'owner')", [id]);
      await conn.query("DELETE FROM auth_sessions WHERE user_id = ?", [id]);
      return id;
    });
  } catch (error) {
    if ((error as Error).message === "OWNER_EXISTS") return { ok: false, message: "The owner account has already been created. Please sign in." };
    logError("setup.owner", error);
    return { ok: false, message: "Could not create the account. Check the database settings and try again." };
  }
  await startSession(userId);
  redirect("/admin");
}

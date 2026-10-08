import "server-only";
import { z } from "zod";
import { AuthorizationError, assertPermission, type SessionUser, type StaffAccess } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import { createSupabaseServerClient, type ServerSupabase } from "@/lib/supabase/server";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/common";
import { logError } from "@/lib/monitoring";

export type ActionResult<T = undefined> = {
  ok: boolean;
  message: string | null;
  errors?: FieldErrors;
  data?: T;
};

export class UserFacingError extends Error {}

type Context = { user: SessionUser; access: StaffAccess; supabase: ServerSupabase };

/**
 * Wraps every admin server action:
 *  1. checks the staff permission on the server (never trusts the UI),
 *  2. gives the action a database client acting as the staff member, so row
 *     level security is enforced a second time,
 *  3. turns validation / database errors into friendly messages.
 */
export async function runAdminAction<T>(
  permission: Permission | Permission[],
  fn: (ctx: Context) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    const { user, access } = await assertAnyPermission(Array.isArray(permission) ? permission : [permission]);
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, message: "Database is not configured." };
    return await fn({ user, access, supabase });
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    if (error instanceof UserFacingError) return { ok: false, message: error.message };
    if (error instanceof z.ZodError) return { ok: false, message: "Please check the highlighted fields.", errors: toFieldErrors(error) };
    logError("admin.action", error, { permission });
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

async function assertAnyPermission(permissions: Permission[]) {
  let lastError: unknown;
  for (const p of permissions) {
    try {
      return await assertPermission(p);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new AuthorizationError();
}

/** Throws a friendly error when a Supabase call failed. */
export function check<T extends { error: { message: string; code?: string } | null }>(result: T, friendly = "Could not save changes."): T {
  if (result.error) {
    if (result.error.code === "23505") throw new UserFacingError("That value is already in use. Please choose another.");
    if (result.error.code === "42501" || result.error.message.includes("FORBIDDEN")) {
      throw new UserFacingError("You don't have permission to do that.");
    }
    logError("admin.db", result.error);
    throw new UserFacingError(friendly);
  }
  return result;
}

/** Reads a JSON payload posted from an admin form. */
export function jsonField(formData: FormData, name = "payload"): unknown {
  const raw = formData.get(name);
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

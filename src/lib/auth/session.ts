import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Permission, StaffRole } from "./permissions";

export type SessionUser = { id: string; email: string | null };

/** The signed-in user (verified JWT), or null. Cached for one request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
});

export type StaffAccess = { role: StaffRole; permissions: Set<Permission> };

/** Staff role + permissions for the signed-in user, or null for customers. */
export const getStaffAccess = cache(async (): Promise<StaffAccess | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("my_staff_access");
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return { role: row.role as StaffRole, permissions: new Set((row.permissions ?? []) as Permission[]) };
});

export class AuthorizationError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For pages: sends visitors to the login page if not signed in. */
export async function requireUser(nextPath: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/** For admin pages: requires a staff account (and optionally a permission). */
export async function requireStaffPage(permission?: Permission): Promise<{ user: SessionUser; access: StaffAccess }> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/admin")}`);
  const access = await getStaffAccess();
  if (!access) redirect("/admin/no-access");
  if (permission && !access.permissions.has(permission)) redirect("/admin/no-access");
  return { user, access };
}

/** For server actions: throws AuthorizationError unless the user has the permission. */
export async function assertPermission(permission: Permission): Promise<{ user: SessionUser; access: StaffAccess }> {
  const user = await getSessionUser();
  if (!user) throw new AuthorizationError("Please sign in again.");
  const access = await getStaffAccess();
  if (!access || !access.permissions.has(permission)) throw new AuthorizationError();
  return { user, access };
}

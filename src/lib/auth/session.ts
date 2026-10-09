import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";
import { getReadyPool } from "@/lib/db/install";
import { getDbConfig, isBuildPhase } from "@/lib/db/pool";
import { ANON, type DbContext } from "@/lib/db/rest/context";
import { sha256Hex } from "@/lib/security/tokens";
import { logError } from "@/lib/monitoring";
import { SESSION_COOKIE } from "./accounts";
import { isStaffRole, permissionsForRole, type Permission, type StaffRole } from "./permissions";

export type SessionUser = { id: string; email: string | null };
export type StaffAccess = { role: StaffRole; permissions: Set<Permission> };

type Session = { user: SessionUser; role: StaffRole | null };

/** The signed-in user (from the session cookie), plus their staff role. Cached for one request. */
const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 200 || isBuildPhase() || !getDbConfig()) return null;
  try {
    const pool = await getReadyPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.email, sm.role
         FROM auth_sessions s
         JOIN auth_users u ON u.id = s.user_id
         LEFT JOIN staff_members sm ON sm.user_id = u.id
        WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP(3) AND u.email_confirmed_at IS NOT NULL`,
      [sha256Hex(token)],
    );
    const row = rows[0];
    if (!row) return null;
    return { user: { id: String(row.id), email: row.email ? String(row.email) : null }, role: isStaffRole(row.role) ? row.role : null };
  } catch (error) {
    logError("auth.session", error);
    return null;
  }
});

/** The signed-in user, or null. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => (await getSession())?.user ?? null);

/** Staff role + permissions for the signed-in user, or null for customers. */
export const getStaffAccess = cache(async (): Promise<StaffAccess | null> => {
  const session = await getSession();
  if (!session?.role) return null;
  return { role: session.role, permissions: permissionsForRole(session.role) };
});

/** Who database queries are made for (used by getUserDb). */
export async function getDbContext(): Promise<DbContext> {
  const session = await getSession();
  if (!session) return ANON;
  return {
    kind: "user",
    userId: session.user.id,
    email: session.user.email,
    perms: session.role ? permissionsForRole(session.role) : new Set(),
    isStaff: session.role !== null,
  };
}

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

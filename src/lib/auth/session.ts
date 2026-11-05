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
import { getAllSettings } from "@/lib/settings";
import { SESSION_COOKIE } from "./accounts";
import { isStaffRole, permissionsForRole, type Permission, type StaffRole } from "./permissions";

export type SessionUser = { id: string; email: string | null };
export type StaffAccess = { role: StaffRole; permissions: Set<Permission> };

type Session = { user: SessionUser; role: StaffRole | null; staffNeedsTwoStepSetup: boolean };

type RawSession = { user: SessionUser; role: StaffRole | null; twoStepOn: boolean; twoStepDone: boolean; ageHours: number };

/** The session cookie's row, before the two-step rules are applied. Cached for one request. */
const getRawSession = cache(async (): Promise<RawSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 200 || isBuildPhase() || !getDbConfig()) return null;
  try {
    const pool = await getReadyPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.email, sm.role, u.totp_enabled_at, s.mfa_at,
              TIMESTAMPDIFF(MINUTE, s.created_at, UTC_TIMESTAMP(3)) / 60 AS age_hours
         FROM auth_sessions s
         JOIN auth_users u ON u.id = s.user_id
         LEFT JOIN staff_members sm ON sm.user_id = u.id
        WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP(3)
          AND (u.email_confirmed_at IS NOT NULL OR u.phone_verified_at IS NOT NULL)`,
      [sha256Hex(token)],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      user: { id: String(row.id), email: row.email ? String(row.email) : null },
      role: isStaffRole(row.role) ? row.role : null,
      twoStepOn: !!row.totp_enabled_at,
      twoStepDone: !!row.mfa_at,
      ageHours: Number(row.age_hours ?? 0),
    };
  } catch (error) {
    logError("auth.session", error);
    return null;
  }
});

/**
 * The signed-in user plus their staff role, after the security rules:
 * - two-step sign-in switched on but not completed in this session → not signed in yet;
 * - staff sign-ins expire after the hours set in Settings → Security;
 * - staff without two-step (when it is required) keep customer access only
 *   until they set it up.
 */
const getSession = cache(async (): Promise<Session | null> => {
  const raw = await getRawSession();
  if (!raw) return null;
  if (raw.twoStepOn && !raw.twoStepDone) return null;
  if (!raw.role) return { user: raw.user, role: null, staffNeedsTwoStepSetup: false };
  const { security } = await getAllSettings();
  if (raw.ageHours > security.staff_session_hours) return null;
  if (security.require_staff_two_step && !raw.twoStepOn) return { user: raw.user, role: null, staffNeedsTwoStepSetup: true };
  return { user: raw.user, role: raw.role, staffNeedsTwoStepSetup: false };
});

/** A sign-in that is waiting for its two-step code (for the code page only). */
export const getPendingTwoStepUser = cache(async (): Promise<SessionUser | null> => {
  const raw = await getRawSession();
  return raw && raw.twoStepOn && !raw.twoStepDone ? raw.user : null;
});

/** True when a staff member must set up two-step sign-in before using the dashboard. */
export const staffNeedsTwoStepSetup = cache(async (): Promise<boolean> => (await getSession())?.staffNeedsTwoStepSetup ?? false);

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
  if (!access && (await staffNeedsTwoStepSetup())) redirect("/account/security?required=1");
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

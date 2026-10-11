import "server-only";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getReadyPool } from "@/lib/db/install";
import { withTransaction } from "@/lib/db/pool";
import { toSqlDateTime } from "@/lib/db/values";
import { randomToken, sha256Hex } from "@/lib/security/tokens";
import { getDummyHash, hashPassword, verifyPassword } from "./password";

/**
 * Customer and staff accounts: sign-up, sign-in, sessions and the one-time
 * links emailed for confirming an address or resetting a password.
 *
 * - Passwords are hashed with scrypt (password.ts).
 * - The browser only holds a random session token in an httpOnly cookie; the
 *   database stores its SHA-256 hash, so a database leak can't be replayed.
 * - Emailed links are single-use and expire.
 */

export const SESSION_COOKIE = "unar_session";
const SESSION_DAYS = 30;

export type TokenPurpose = "verify_email" | "reset_password";

export class EmailTakenError extends Error {
  constructor() {
    super("An account with this email already exists.");
  }
}

type UserRow = { id: string; email: string; password_hash: string; email_confirmed_at: string | null };

const now = () => toSqlDateTime(new Date())!;
const inMinutes = (minutes: number) => toSqlDateTime(new Date(Date.now() + minutes * 60_000))!;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const pool = await getReadyPool();
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id, email, password_hash, email_confirmed_at FROM auth_users WHERE email = ?", [normalizeEmail(email)]);
  return (rows[0] as UserRow | undefined) ?? null;
}

export async function findUserById(id: string): Promise<{ id: string; email: string; email_confirmed_at: string | null } | null> {
  const pool = await getReadyPool();
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id, email, email_confirmed_at FROM auth_users WHERE id = ?", [id]);
  return (rows[0] as { id: string; email: string; email_confirmed_at: string | null } | undefined) ?? null;
}

/** Creates the login and the customer profile together. */
export async function createUser(input: {
  email: string;
  password: string;
  fullName?: string | null;
  confirmed: boolean;
  marketingConsent?: boolean;
}): Promise<string> {
  const pool = await getReadyPool();
  const id = randomUUID();
  const email = normalizeEmail(input.email);
  const hash = await hashPassword(input.password);
  await withTransaction(pool, async (conn) => {
    try {
      await conn.query("INSERT INTO auth_users (id, email, password_hash, email_confirmed_at) VALUES (?, ?, ?, ?)", [
        id,
        email,
        hash,
        input.confirmed ? now() : null,
      ]);
    } catch (error) {
      if ((error as { errno?: number }).errno === 1062) throw new EmailTakenError();
      throw error;
    }
    await conn.query("INSERT INTO profiles (id, email, full_name, marketing_consent) VALUES (?, ?, ?, ?)", [
      id,
      email,
      input.fullName?.trim().slice(0, 120) || null,
      input.marketingConsent ? 1 : 0,
    ]);
  });
  return id;
}

export type AuthResult = { ok: true; userId: string } | { ok: false; reason: "invalid" | "email_not_confirmed" };

/** Checks an email + password. Takes the same time whether or not the account exists. */
export async function authenticate(email: string, password: string): Promise<AuthResult> {
  const user = await findUserByEmail(email);
  const valid = await verifyPassword(password, user?.password_hash ?? (await getDummyHash()));
  if (!user || !valid) return { ok: false, reason: "invalid" };
  if (!user.email_confirmed_at) return { ok: false, reason: "email_not_confirmed" };
  return { ok: true, userId: user.id };
}

async function cookieIsSecure(): Promise<boolean> {
  const h = await headers();
  const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim();
  const host = h.get("host") ?? "";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  // The public production store uses HTTPS even if an internal proxy hop uses HTTP.
  return proto === "https" || (process.env.NODE_ENV === "production" && !local);
}

/** Signs the user in on this browser (server actions and route handlers only). */
export async function startSession(userId: string): Promise<void> {
  const pool = await getReadyPool();
  const token = randomToken(32);
  const h = await headers();
  await pool.query("INSERT INTO auth_sessions (id, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)", [
    sha256Hex(token),
    userId,
    inMinutes(SESSION_DAYS * 24 * 60),
    (h.get("user-agent") ?? "").slice(0, 300) || null,
  ]);
  await pool.query("UPDATE auth_users SET last_sign_in_at = ? WHERE id = ?", [now(), userId]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: await cookieIsSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

/** Signs out of this browser. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const pool = await getReadyPool().catch(() => null);
    await pool?.query("DELETE FROM auth_sessions WHERE id = ?", [sha256Hex(token)]);
  }
  store.delete(SESSION_COOKIE);
}

/** Signs a user out everywhere (after a password change). */
export async function endAllSessions(userId: string): Promise<void> {
  const pool = await getReadyPool();
  await pool.query("DELETE FROM auth_sessions WHERE user_id = ?", [userId]);
}

/** Creates a single-use link token (only its hash is stored). */
export async function issueToken(userId: string, purpose: TokenPurpose, ttlMinutes: number): Promise<string> {
  const pool = await getReadyPool();
  const token = randomToken(32);
  // Keep delivered links valid if a later email fails to send. Consuming any
  // link revokes all its siblings atomically below.
  await pool.query("INSERT INTO auth_tokens (id, user_id, purpose, expires_at) VALUES (?, ?, ?, ?)", [sha256Hex(token), userId, purpose, inMinutes(ttlMinutes)]);
  return token;
}

/** Uses up a link token. Returns the user id, or null if the link is invalid, used or expired. */
export async function consumeToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const pool = await getReadyPool();
  const id = sha256Hex(token);
  return withTransaction(pool, async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT user_id FROM auth_tokens WHERE id = ? AND purpose = ?", [id, purpose]);
    const userId = rows[0]?.user_id as string | undefined;
    if (!userId) return null;
    // Lock the account first: concurrent sibling links cannot both succeed.
    await conn.query("SELECT id FROM auth_users WHERE id = ? FOR UPDATE", [userId]);
    const [result] = await conn.query<ResultSetHeader>(
      "UPDATE auth_tokens SET used_at = ? WHERE id = ? AND purpose = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP(3)",
      [now(), id, purpose],
    );
    if (result.affectedRows !== 1) return null;
    await conn.query("UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL", [now(), userId, purpose]);
    return userId;
  });
}

export async function confirmEmail(userId: string): Promise<void> {
  const pool = await getReadyPool();
  await pool.query("UPDATE auth_users SET email_confirmed_at = COALESCE(email_confirmed_at, ?) WHERE id = ?", [now(), userId]);
}

export async function setPassword(userId: string, password: string): Promise<void> {
  const pool = await getReadyPool();
  await pool.query("UPDATE auth_users SET password_hash = ? WHERE id = ?", [await hashPassword(password), userId]);
}

/** Removes expired sessions and links (run by the scheduled clean-up). */
export async function cleanupAuth(): Promise<void> {
  const pool = await getReadyPool();
  await pool.query("DELETE FROM auth_sessions WHERE expires_at < UTC_TIMESTAMP(3)");
  await pool.query("DELETE FROM auth_tokens WHERE expires_at < UTC_TIMESTAMP(3) - INTERVAL 7 DAY");
}

import "server-only";
import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { withTransaction } from "@/lib/db/pool";
import { randomToken } from "@/lib/security/tokens";
import { hashPassword } from "./password";
import type { GoogleClaims } from "./google-token";

/** Google can verify a new customer, but never silently activates a local unconfirmed account or links staff. */
export async function persistVerifiedGoogleCustomer(pool: Pool, identity: GoogleClaims): Promise<string> {
  const passwordHash = await hashPassword(randomToken(48));
  return withTransaction(pool, async (conn) => {
    const [linked] = await conn.query<RowDataPacket[]>("SELECT user_id FROM auth_identities WHERE provider = 'google' AND subject = ?", [identity.sub]);
    if (linked[0]) {
      const [staff] = await conn.query<RowDataPacket[]>("SELECT user_id FROM staff_members WHERE user_id = ?", [linked[0].user_id]);
      if (staff.length) throw new Error("Use password sign-in for staff accounts");
      return String(linked[0].user_id);
    }
    const [existing] = await conn.query<RowDataPacket[]>("SELECT id, email_confirmed_at FROM auth_users WHERE email = ? FOR UPDATE", [identity.email]);
    let userId: string;
    if (existing[0]) {
      userId = String(existing[0].id);
      const [staff] = await conn.query<RowDataPacket[]>("SELECT user_id FROM staff_members WHERE user_id = ?", [userId]);
      if (staff.length || !existing[0].email_confirmed_at) throw new Error("Use existing account sign-in and email confirmation");
    } else {
      userId = randomUUID();
      await conn.query("INSERT INTO auth_users (id, email, password_hash, email_confirmed_at) VALUES (?, ?, ?, UTC_TIMESTAMP(3))", [userId, identity.email, passwordHash]);
      await conn.query("INSERT INTO profiles (id, email, full_name, marketing_consent) VALUES (?, ?, ?, 0)", [userId, identity.email, identity.name || null]);
    }
    await conn.query("INSERT INTO auth_identities (provider, subject, user_id) VALUES ('google', ?, ?)", [identity.sub, userId]);
    return userId;
  });
}

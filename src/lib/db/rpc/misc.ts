import type { Pool } from "mysql2/promise";
import { ROLE_PERMISSIONS, isStaffRole } from "@/lib/auth/permissions";
import { type DbContext } from "../rest/context";
import { toSqlDateTime } from "../values";
import { actorId, exec, insertRow, int, left, one, requireService, requireStaff, tx } from "./helpers";

/** Rate limiting (fixed window, shared by all server processes). Returns true when allowed. */
export async function check_rate_limit(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requireService(ctx);
  const windowSeconds = Math.max(1, int(args.p_window_seconds) ?? 60);
  const limit = int(args.p_limit) ?? 0;
  const key = String(args.p_key ?? "").slice(0, 200);
  const windowStart = toSqlDateTime(new Date(Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds * 1000));
  const count = await tx(pool, async (conn) => {
    await exec(conn, "INSERT INTO rate_limits (`key`, window_start, `count`) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE `count` = `count` + 1", [key, windowStart]);
    const row = await one(conn, "SELECT `count` FROM rate_limits WHERE `key` = ? AND window_start = ?", [key, windowStart]);
    return Number(row?.count ?? 1);
  });
  return count <= limit;
}

/** Daily clean-up of old rate-limit counters and expired sign-ins. */
export async function cleanup_rate_limits(ctx: DbContext, _args: Record<string, unknown>, pool: Pool) {
  requireService(ctx);
  await exec(pool, "DELETE FROM rate_limits WHERE window_start < UTC_TIMESTAMP(3) - INTERVAL 1 DAY");
  await exec(pool, "DELETE FROM auth_sessions WHERE expires_at < UTC_TIMESTAMP(3)");
  await exec(pool, "DELETE FROM auth_tokens WHERE expires_at < UTC_TIMESTAMP(3) - INTERVAL 7 DAY");
  await exec(pool, "DELETE FROM review_media WHERE review_id IS NULL AND created_at < UTC_TIMESTAMP(3) - INTERVAL 1 DAY");
  return null;
}

export async function log_admin_action(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requireStaff(ctx);
  const actor = actorId(ctx);
  const user = actor ? await one(pool, "SELECT email FROM auth_users WHERE id = ?", [actor]) : undefined;
  await insertRow(pool, "audit_logs", {
    actor_id: actor,
    actor_email: user?.email ?? null,
    action: left(args.p_action, 80) ?? "unknown",
    entity_type: left(args.p_entity_type, 40) ?? "unknown",
    entity_id: left(args.p_entity_id, 100),
    summary: left(args.p_summary, 500),
    diff: args.p_diff ?? null,
  });
  return null;
}

/** The signed-in staff member's role and permissions ([] for customers). */
export async function my_staff_access(ctx: DbContext, _args: Record<string, unknown>, pool: Pool) {
  if (ctx.kind !== "user") return [];
  const row = await one(pool, "SELECT role FROM staff_members WHERE user_id = ?", [ctx.userId]);
  if (!row || !isStaffRole(row.role)) return [];
  return [{ role: row.role, permissions: [...ROLE_PERMISSIONS[row.role]].sort() }];
}

import type { Permission } from "@/lib/auth/permissions";

/**
 * Who a database request is made for. Access rules (policies.ts) are applied
 * for "anon" (public visitors) and "user" (signed-in customers and staff).
 * "service" is trusted server code that has ALREADY checked permissions
 * (checkout, payment webhooks, carts, scheduled jobs) and sees everything.
 */
export type DbContext =
  | { kind: "service" }
  | { kind: "anon" }
  | { kind: "user"; userId: string; email: string | null; perms: ReadonlySet<Permission>; isStaff: boolean };

export type UserContext = Extract<DbContext, { kind: "user" }>;

export const SERVICE: DbContext = { kind: "service" };
export const ANON: DbContext = { kind: "anon" };

export function hasPerm(ctx: DbContext, ...perms: Permission[]): boolean {
  if (ctx.kind === "service") return true;
  if (ctx.kind !== "user") return false;
  return perms.some((p) => ctx.perms.has(p));
}

/** Error in the same shape the data API has always returned ({ code, message, details, hint }). */
export class DbError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details: string | null = null,
    public hint: string | null = null,
  ) {
    super(message);
    this.name = "DbError";
  }

  toJSON() {
    return { code: this.code, message: this.message, details: this.details, hint: this.hint };
  }
}

/** Business rule failures raised by the commerce functions, e.g. "INSUFFICIENT_STOCK:SKU". */
export function raise(message: string, code = "P0001"): never {
  throw new DbError(code, message, 400);
}

export function forbidden(message = "permission denied"): never {
  throw new DbError("42501", message, 403);
}

type MysqlError = Error & { errno?: number; code?: string; sqlMessage?: string };

/** Translates MySQL errors into the codes the app already understands. */
export function toDbError(error: unknown): DbError {
  if (error instanceof DbError) return error;
  const e = error as MysqlError;
  const raw = e?.sqlMessage ?? e?.message ?? String(error);
  switch (e?.errno) {
    case 1062: {
      const key = /for key '([^']+)'/.exec(raw)?.[1]?.split(".").at(-1) ?? "unique";
      return new DbError("23505", `duplicate key value violates unique constraint "${key}"`, 409, raw);
    }
    case 1451:
      return new DbError("23503", "update or delete violates a foreign key constraint", 409, raw);
    case 1452:
      return new DbError("23503", "insert or update violates a foreign key constraint", 409, raw);
    case 3819: // MySQL check constraint
    case 4025: // MariaDB check constraint
      return new DbError("23514", "new row violates a check constraint", 400, raw);
    case 1048:
    case 1364:
      return new DbError("23502", "null value violates a not-null constraint", 400, raw);
    case 1406:
      return new DbError("22001", "value too long for this field", 400, raw);
    case 1264:
    case 1366:
    case 1292:
    case 3140:
      return new DbError("22P02", "invalid value for this field", 400, raw);
    case 1213:
    case 1205:
      return new DbError("40001", "the database was busy, please try again", 409, raw);
  }
  if (e?.code === "ECONNREFUSED" || e?.code === "ENOTFOUND" || e?.code === "ETIMEDOUT" || e?.code === "ER_ACCESS_DENIED_ERROR" || e?.code === "ER_BAD_DB_ERROR") {
    return new DbError("DB_UNAVAILABLE", `Database connection failed (${e.code})`, 500);
  }
  return new DbError("XX000", raw || "Database error", 500);
}

import "server-only";
import { cache } from "react";
import { PostgrestClient } from "@supabase/postgrest-js";
import { connection } from "next/server";
import { getDbContext } from "@/lib/auth/session";
import type { Database } from "./database.types";
import { DatabaseNotConfiguredError, getReadyPool } from "./install";
import { getDbConfig, isBuildPhase } from "./pool";
import { ANON, SERVICE, type DbContext } from "./rest/context";
import { handleDataRequest } from "./rest/handler";
import { RPCS } from "./rpc";

/**
 * Database clients. All three speak the same query language
 * (`db.from("products").select(...).eq(...)`, `db.rpc("create_order", ...)`)
 * and run against the MySQL / MariaDB database configured in Hostinger.
 *
 * - getPublicDb():  what any visitor may see (published products, content).
 * - getUserDb():    acts as the signed-in customer or staff member; the access
 *                   rules in rest/policies.ts apply.
 * - getServiceDb(): trusted server code that has ALREADY checked permissions
 *                   (checkout, payment webhooks, carts, scheduled jobs).
 */

export type Db = PostgrestClient<Database>;

const BASE_URL = "http://unar.db/rest";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function createDb(resolveCtx: () => DbContext | Promise<DbContext>): Db {
  const dbFetch: typeof fetch = async (input, init) => {
    // While the site is being built there is no database: pages that need it
    // are rendered when visitors open them instead.
    if (isBuildPhase()) {
      await connection();
      return json(500, { code: "DB_BUILD_PHASE", message: "The database is not used while the site is being built.", details: null, hint: null });
    }
    let pool;
    try {
      pool = await getReadyPool();
    } catch (error) {
      const notConfigured = error instanceof DatabaseNotConfiguredError;
      return json(500, {
        code: notConfigured ? "DB_NOT_CONFIGURED" : "DB_UNAVAILABLE",
        message: (error as Error).message,
        details: null,
        hint: null,
      });
    }
    return handleDataRequest(pool, await resolveCtx(), RPCS, input as string, init);
  };
  return new PostgrestClient<Database>(BASE_URL, { fetch: dbFetch, retry: false });
}

export function isDatabaseConfigured(): boolean {
  return getDbConfig() !== null;
}

const globalForClients = globalThis as unknown as { __unarServiceDb?: Db; __unarPublicDb?: Db };

/** Trusted server code only (checks permissions itself). Null until the database is configured. */
export function getServiceDb(): Db | null {
  if (!isDatabaseConfigured()) return null;
  globalForClients.__unarServiceDb ??= createDb(() => SERVICE);
  return globalForClients.__unarServiceDb;
}

export function requireServiceDb(): Db {
  const db = getServiceDb();
  if (!db) throw new DatabaseNotConfiguredError();
  return db;
}

/** Public, signed-out view of the data (safe for any page). */
export function getPublicDb(): Db | null {
  if (!isDatabaseConfigured()) return null;
  globalForClients.__unarPublicDb ??= createDb(() => ANON);
  return globalForClients.__unarPublicDb;
}

/** Acts as the signed-in user (or as a visitor when nobody is signed in). Cached per request. */
export const getUserDb = cache(async (): Promise<Db | null> => {
  if (!isDatabaseConfigured()) return null;
  return createDb(() => getDbContext());
});

import { PostgrestClient } from "@supabase/postgrest-js";
import type { Pool, PoolConnection } from "mysql2/promise";
import type { Database } from "../database.types";
import { withTransaction } from "../pool";
import type { DbContext } from "./context";
import { handleDataRequest } from "./handler";

/** One transaction for a multi-table edit; every query retains the caller's access rules.
 * The callback must throw on query errors, so the entire edit is rolled back. */
export async function withDbTransaction<T>(pool: Pool, ctx: DbContext, fn: (db: PostgrestClient<Database>, conn: PoolConnection) => Promise<T>): Promise<T> {
  return withTransaction(pool, async (conn) => {
    let failed = false;
    const db = new PostgrestClient<Database>("http://unar.db/rest", {
      fetch: async (input, init) => {
        const response = await handleDataRequest(pool, ctx, {}, input as string, init, conn);
        if (!response.ok) failed = true;
        return response;
      },
      retry: false,
    });
    const result = await fn(db, conn);
    if (failed) throw new Error("A query failed; the complete edit was rolled back.");
    return result;
  });
}

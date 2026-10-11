import "server-only";
import type { Pool } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { withTransaction } from "@/lib/db/pool";

type DraftSection = { key: string; type: string; sort_order: number; is_visible: boolean; content: unknown; updated_by: string };
/** Called only after server-side content.write authorization and schema validation. */
export async function replaceHomeDraft(pool: Pool, rows: DraftSection[]) {
  await withTransaction(pool, async (conn) => {
    // One shared row serializes homepage saves across staff accounts.
    await conn.query("SELECT `key` FROM settings WHERE `key` = 'store' FOR UPDATE");
    await conn.query("DELETE FROM cms_sections WHERE page = 'home' AND state = 'draft'");
    for (const row of rows) {
      await conn.execute("INSERT INTO cms_sections (id, page, `key`, type, state, sort_order, is_visible, content, updated_by) VALUES (?, 'home', ?, ?, 'draft', ?, ?, ?, ?)", [randomUUID(), row.key, row.type, row.sort_order, row.is_visible ? 1 : 0, JSON.stringify(row.content), row.updated_by]);
    }
  });
}

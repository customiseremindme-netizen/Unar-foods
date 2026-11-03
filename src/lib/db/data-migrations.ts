import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import initialData from "./data/initial-data.json";
import { prepareInsertRow } from "./rows";
import { TABLES } from "./schema";
import { keyName } from "./ddl";

/**
 * Versioned data fixes for databases that were set up earlier.
 *
 * Starter data (initial-data.json) is loaded only once, so a correction to it
 * never reaches a database that already exists. Each step below repairs such
 * a database. Rules every step follows:
 * - it runs once (its id is stored in schema_meta) and is safe to run again;
 * - it only changes a value that is STILL exactly what the old starter data
 *   wrote, so anything the owner edited in the dashboard is left alone;
 * - it never inserts duplicates and never deletes anything.
 *
 * To add a fix: append a new step with a new id. Never edit or reorder old ones.
 */
export type DataMigration = { id: string; description: string; run: (conn: PoolConnection) => Promise<void> };

const DRY_FRUITS = "2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e01";
const FRESH_RAW = "2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e02";

/** UPDATE one column only while it still holds the old starter value. */
async function replaceIfUnchanged(conn: PoolConnection, table: string, id: string, column: string, from: string | null, to: string) {
  if (from === null) {
    await conn.query(`UPDATE \`${table}\` SET \`${column}\` = ? WHERE id = ? AND \`${column}\` IS NULL`, [to, id]);
  } else {
    await conn.query(`UPDATE \`${table}\` SET \`${column}\` = ? WHERE id = ? AND \`${column}\` = ?`, [to, id, from]);
  }
}

// Image id → [old sort order, old kind, new sort order, new kind]
const IMAGE_ORDER: Record<string, Record<string, [number, string, number, string]>> = {
  [DRY_FRUITS]: {
    "365e5ef8-8f3c-4232-bc87-1db861ca7cf6": [1, "packshot", 1, "packshot"], // 01 main hero
    "6a9d960f-f015-415c-ad98-d2df72d0e5c2": [3, "packshot", 2, "packshot"], // 02 front & back
    "edac76bc-f363-46c0-9ebe-d95ecfa694b2": [4, "lifestyle", 3, "lifestyle"], // 03 ingredients / benefits
    "d78f3c3a-6068-4e40-a056-b269de2876c3": [2, "packshot", 4, "packshot"], // 04 beauty shot
    "6720d595-1452-4bca-8fd5-e75fa6b79b8d": [5, "lifestyle", 5, "lifestyle"], // 05 lifestyle
    "5124e0b5-ccd6-42fc-a8f0-0d2d7f7c16ab": [6, "front_label", 6, "front_label"],
    "f81417bc-6d2a-4fb5-a914-f6a0237cffd7": [7, "back_label", 7, "back_label"],
  },
  [FRESH_RAW]: {
    "92b61a62-d7b3-4d51-816b-20e4ca02aaca": [5, "packshot", 1, "packshot"],
    "4e78b6ed-4410-4943-aa5b-f440fb0f373c": [4, "packshot", 2, "packshot"],
    "8733a4ad-7bbf-4e0d-98ae-94c4329e9e47": [2, "packshot", 3, "lifestyle"],
    "d293d318-b62d-4a37-b997-486b14b1a910": [1, "packshot", 4, "packshot"],
    "6bfdeaf0-61a7-45ac-9e2f-57b3faffd9eb": [3, "lifestyle", 5, "lifestyle"],
    "0c7cbc55-5190-48f6-836c-c49261f65a99": [6, "front_label", 6, "front_label"],
    "8b213345-0b15-4fb7-ae03-23cf8a42b19c": [7, "back_label", 7, "back_label"],
  },
};

export const DATA_MIGRATIONS: DataMigration[] = [
  {
    id: "2026-11-01-starter-products",
    description: "Publish the two starter products, use their full UNAR names and the 01–05 photo order",
    async run(conn) {
      const names: [string, string, string, string, string, string, string][] = [
        [
          DRY_FRUITS,
          "Dehydrated Banana Chewy — With Dry Fruits & Seeds",
          "UNAR Dehydrated Banana Chewy — With Dry Fruits & Seeds",
          "Banana Chewy — Dry Fruits & Seeds",
          "Banana Chewy — With Dry Fruits & Seeds",
          "Banana Chewy with Dry Fruits & Seeds (100 g)",
          "UNAR Dehydrated Banana Chewy — With Dry Fruits & Seeds (100 g)",
        ],
        [
          FRESH_RAW,
          "Dehydrated Banana Chewy — Fresh Raw Banana",
          "UNAR Dehydrated Banana Chewy — Fresh Raw Banana",
          "Banana Chewy — Fresh Raw Banana",
          "Banana Chewy — Fresh Raw Banana",
          "Banana Chewy — Fresh Raw Banana (100 g)",
          "UNAR Dehydrated Banana Chewy — Fresh Raw Banana (100 g)",
        ],
      ];
      for (const [id, oldTitle, newTitle, oldShort, newShort, oldSeo, newSeo] of names) {
        await replaceIfUnchanged(conn, "products", id, "title", oldTitle, newTitle);
        await replaceIfUnchanged(conn, "products", id, "short_title", oldShort, newShort);
        await replaceIfUnchanged(conn, "products", id, "seo_title", oldSeo, newSeo);
        // Publish only if it was never published (an owner who unpublished or archived it keeps that choice).
        await conn.query(
          "UPDATE products SET status = 'published', published_at = UTC_TIMESTAMP(3) WHERE id = ? AND status = 'draft' AND published_at IS NULL",
          [id],
        );
      }

      // Re-order the gallery only if the owner has not re-ordered it already.
      for (const [productId, images] of Object.entries(IMAGE_ORDER)) {
        const [rows] = await conn.query<RowDataPacket[]>("SELECT id, sort_order, kind FROM product_images WHERE product_id = ?", [productId]);
        const untouched =
          rows.length === Object.keys(images).length &&
          rows.every((r) => {
            const seed = images[String(r.id)];
            return !!seed && Number(r.sort_order) === seed[0] && String(r.kind) === seed[1];
          });
        if (!untouched) continue;
        for (const [imageId, [, , order, kind]] of Object.entries(images)) {
          await conn.query("UPDATE product_images SET sort_order = ?, kind = ? WHERE id = ?", [order, kind, imageId]);
        }
      }
    },
  },
  {
    id: "2026-11-01-home-sections",
    description: "Add the homepage sections Ingredients, How to enjoy and Verified benefits",
    async run(conn) {
      // Copied from the starter data; a section the database already has (same page/key/state) is left alone.
      const keys = new Set(["ingredients", "enjoy", "benefits"]);
      const rows = (initialData.cms_sections as Record<string, unknown>[]).filter((r) => keys.has(String(r.key)));
      for (const input of rows) {
        const row = prepareInsertRow("cms_sections", TABLES.cms_sections!, input);
        const cols = Object.keys(row);
        await conn.query(
          `INSERT INTO cms_sections (${cols.map((c) => `\`${c}\``).join(", ")}) VALUES (${cols.map(() => "?").join(", ")}) ON DUPLICATE KEY UPDATE id = id`,
          cols.map((c) => row[c]),
        );
      }
    },
  },
  {
    id: "2026-11-03-payment-methods",
    description: "Allow the new payment methods (PhonePe, UPI to the shop's UPI ID) on orders",
    async run(conn) {
      // The installer only adds rules; a changed rule has to be replaced here.
      const checks = TABLES.orders!.checks ?? [];
      const index = checks.findIndex((c) => c.includes("`payment_method`"));
      if (index < 0) return;
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT cc.CONSTRAINT_NAME AS name, cc.CHECK_CLAUSE AS clause
           FROM information_schema.CHECK_CONSTRAINTS cc
           JOIN information_schema.TABLE_CONSTRAINTS tc
             ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
          WHERE cc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'orders' AND tc.CONSTRAINT_TYPE = 'CHECK'`,
      );
      const old = rows.filter((r) => String(r.clause).includes("payment_method") && !String(r.clause).includes("upi_manual"));
      for (const r of old) await conn.query(`ALTER TABLE orders DROP CONSTRAINT \`${String(r.name).replace(/`/g, "")}\``);
      const name = keyName("ck", "orders", String(index + 1));
      const present = rows.some((r) => r.name === name && String(r.clause).includes("upi_manual"));
      if (!present) await conn.query(`ALTER TABLE orders ADD CONSTRAINT \`${name}\` CHECK (${checks[index]})`);
    },
  },
];

/** Runs every step that has not run yet, in order. Returns the ids that ran. */
export async function runDataMigrations(conn: PoolConnection, done: Set<string>, markDone: (id: string) => Promise<void>): Promise<string[]> {
  const ran: string[] = [];
  for (const step of DATA_MIGRATIONS) {
    if (done.has(step.id)) continue;
    await conn.beginTransaction();
    try {
      await step.run(conn);
      await markDone(step.id);
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    }
    ran.push(step.id);
  }
  return ran;
}

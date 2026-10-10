/**
 * Automatic database setup on a real MySQL / MariaDB server.
 * Skipped unless TEST_DATABASE_URL points at an EMPTY test database:
 *
 *   TEST_DATABASE_URL=mysql://unar:unarpw@127.0.0.1:3306/unar npm run test:db
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { installSchema } from "@/lib/db/install";
import { TABLES } from "@/lib/db/schema";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("automatic database setup", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = mysql.createPool({ uri: url!, connectionLimit: 4, dateStrings: true, timezone: "Z" });
    // start from an empty database
    const [tables] = await pool.query<RowDataPacket[]>("SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
    await pool.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const row of tables) await pool.query(`DROP TABLE \`${row.t}\``);
    await pool.query("SET FOREIGN_KEY_CHECKS = 1");
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("creates every table and the starter content on first start", async () => {
    const first = await installSchema(pool);
    expect(first).toEqual({ migrated: true, seeded: true });
    const [tables] = await pool.query<RowDataPacket[]>("SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
    expect(tables.map((r) => r.t).sort()).toEqual(Object.keys(TABLES).sort());
    const [products] = await pool.query<RowDataPacket[]>("SELECT slug, status FROM products ORDER BY sort_order");
    expect(products.length).toBe(2);
    expect(products.every((p) => p.status === "published")).toBe(true);
    const [variants] = await pool.query<RowDataPacket[]>("SELECT SUM(stock) AS s FROM product_variants");
    expect(Number(variants[0].s)).toBe(0);
  });

  it("does nothing on the next start", async () => {
    expect(await installSchema(pool)).toEqual({ migrated: false, seeded: false });
  });

  it("repairs only untouched legacy drafts, once, with a rollback record", async () => {
    await pool.query("DELETE FROM schema_meta WHERE `key` = 'catalog_launch_v1'");
    await pool.query("DELETE FROM migration_backups WHERE `key` = 'catalog_launch_v1_backup'");
    await pool.query("UPDATE products SET status = 'draft', published_at = NULL, updated_at = created_at");
    await pool.query("UPDATE products SET short_description = 'Owner edited this product', updated_at = DATE_ADD(created_at, INTERVAL 1 SECOND) WHERE sort_order = 2");
    await installSchema(pool);
    const [products] = await pool.query<RowDataPacket[]>("SELECT id, status FROM products ORDER BY sort_order");
    expect(products.map((p) => p.status)).toEqual(["published", "draft"]);
    const [meta] = await pool.query<RowDataPacket[]>("SELECT `value` FROM migration_backups WHERE `key` = 'catalog_launch_v1_backup'");
    expect(JSON.parse(meta[0].value).map((p: { id: string }) => p.id)).toEqual([products[0].id]);
    await installSchema(pool);
    const [after] = await pool.query<RowDataPacket[]>("SELECT status FROM products ORDER BY sort_order");
    expect(after.map((p) => p.status)).toEqual(["published", "draft"]);
    const { stdout } = await promisify(execFile)(process.execPath, ["scripts/rollback-catalog-repair.mjs", "--apply"], { env: { ...process.env, DATABASE_URL: url! }, timeout: 15000 });
    expect(stdout).toContain("Restored 1 untouched product(s)");
    await installSchema(pool);
    const [rolledBack] = await pool.query<RowDataPacket[]>("SELECT status, short_description FROM products ORDER BY sort_order");
    expect(rolledBack.map((p) => p.status)).toEqual(["draft", "draft"]);
    expect(rolledBack[1].short_description).toBe("Owner edited this product");
  });

  it("can run from several servers at the same time", async () => {
    await pool.query("UPDATE schema_meta SET `value` = 'old' WHERE `key` = 'schema_fingerprint'");
    const results = await Promise.all([installSchema(pool), installSchema(pool), installSchema(pool)]);
    expect(results.filter((r) => r.migrated).length).toBe(1);
  });

  it("adds a missing column without touching data", async () => {
    await pool.query("ALTER TABLE products DROP COLUMN og_image_url");
    await pool.query("UPDATE schema_meta SET `value` = 'old' WHERE `key` = 'schema_fingerprint'");
    expect((await installSchema(pool)).migrated).toBe(true);
    const [cols] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'og_image_url'",
    );
    expect(Number(cols[0].n)).toBe(1);
    const [products] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM products");
    expect(Number(products[0].n)).toBe(2);
  });

  it("does not load the starter content again after the owner deletes it", async () => {
    await pool.query("DELETE FROM faqs");
    await pool.query("UPDATE schema_meta SET `value` = 'old' WHERE `key` = 'schema_fingerprint'");
    await installSchema(pool);
    const [faqs] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM faqs");
    expect(Number(faqs[0].n)).toBe(0);
  });

  it("enforces stock and relationship rules in the database", async () => {
    await expect(pool.query("UPDATE product_variants SET stock = -1")).rejects.toThrow();
    await expect(
      pool.query("INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES ('00000000-0000-4000-8000-000000000000', '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e01', 1)"),
    ).rejects.toThrow();
  });
});

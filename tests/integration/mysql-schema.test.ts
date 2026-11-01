/**
 * Automatic database setup on a real MySQL / MariaDB server.
 * Skipped unless TEST_DATABASE_URL points at an EMPTY test database:
 *
 *   TEST_DATABASE_URL=mysql://unar:unarpw@127.0.0.1:3306/unar npm run test:db
 */
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
    expect(first).toMatchObject({ migrated: true, seeded: true });
    const [tables] = await pool.query<RowDataPacket[]>("SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
    expect(tables.map((r) => r.t).sort()).toEqual(Object.keys(TABLES).sort());
    const [products] = await pool.query<RowDataPacket[]>("SELECT slug, title, status FROM products ORDER BY sort_order");
    expect(products.map((p) => [p.title, p.status])).toEqual([
      ["UNAR Dehydrated Banana Chewy — With Dry Fruits & Seeds", "published"],
      ["UNAR Dehydrated Banana Chewy — Fresh Raw Banana", "published"],
    ]);
    const [images] = await pool.query<RowDataPacket[]>(
      "SELECT p.slug, i.url FROM product_images i JOIN products p ON p.id = i.product_id WHERE i.kind NOT LIKE '%label' ORDER BY p.sort_order, i.sort_order",
    );
    for (const slug of ["banana-chewy-dry-fruits-seeds", "banana-chewy-fresh-raw-banana"]) {
      const files = images.filter((i) => i.slug === slug).map((i) => String(i.url).split("/").pop()!.slice(0, 2));
      expect(files).toEqual(["01", "02", "03", "04", "05"]);
    }
    const [variants] = await pool.query<RowDataPacket[]>("SELECT SUM(stock) AS s FROM product_variants");
    expect(Number(variants[0].s)).toBe(0);
  });

  it("does nothing on the next start", async () => {
    expect(await installSchema(pool)).toEqual({ migrated: false, seeded: false, dataFixes: [] });
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

  it("repairs a database set up with the old starter data, without overwriting the owner's edits", async () => {
    const dry = "2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e01";
    const raw = "2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e02";
    // Put the database back into the state the old starter data left it in…
    await pool.query("UPDATE products SET status = 'draft', published_at = NULL, title = 'Dehydrated Banana Chewy — With Dry Fruits & Seeds', short_title = 'Banana Chewy — Dry Fruits & Seeds' WHERE id = ?", [dry]);
    // …except that the owner renamed the second product and re-ordered its photos.
    await pool.query("UPDATE products SET status = 'draft', published_at = NULL, title = 'My own name' WHERE id = ?", [raw]);
    const oldDry: [string, number, string][] = [
      ["365e5ef8-8f3c-4232-bc87-1db861ca7cf6", 1, "packshot"],
      ["6a9d960f-f015-415c-ad98-d2df72d0e5c2", 3, "packshot"],
      ["edac76bc-f363-46c0-9ebe-d95ecfa694b2", 4, "lifestyle"],
      ["d78f3c3a-6068-4e40-a056-b269de2876c3", 2, "packshot"],
      ["6720d595-1452-4bca-8fd5-e75fa6b79b8d", 5, "lifestyle"],
    ];
    for (const [id, order, kind] of oldDry) await pool.query("UPDATE product_images SET sort_order = ?, kind = ? WHERE id = ?", [order, kind, id]);
    await pool.query("UPDATE product_images SET sort_order = 9 WHERE id = '92b61a62-d7b3-4d51-816b-20e4ca02aaca'");
    await pool.query("DELETE FROM schema_meta WHERE `key` LIKE 'data_migration:%'");
    const [before] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM products");

    const results = await Promise.all([installSchema(pool), installSchema(pool)]);
    expect(results.flatMap((r) => r.dataFixes)).toEqual(["2026-11-01-starter-products"]);

    const [products] = await pool.query<RowDataPacket[]>("SELECT id, title, short_title, status, published_at FROM products ORDER BY sort_order");
    expect(products.length).toBe(Number(before[0].n));
    expect(products[0]).toMatchObject({ title: "UNAR Dehydrated Banana Chewy — With Dry Fruits & Seeds", short_title: "Banana Chewy — With Dry Fruits & Seeds", status: "published" });
    expect(products[0].published_at).not.toBeNull();
    expect(products[1]).toMatchObject({ title: "My own name", status: "published" });
    const [dryImages] = await pool.query<RowDataPacket[]>("SELECT url FROM product_images WHERE product_id = ? AND kind NOT LIKE '%label' ORDER BY sort_order", [dry]);
    expect(dryImages.map((i) => String(i.url).split("/").pop()!.slice(0, 2))).toEqual(["01", "02", "03", "04", "05"]);
    const [moved] = await pool.query<RowDataPacket[]>("SELECT sort_order FROM product_images WHERE id = '92b61a62-d7b3-4d51-816b-20e4ca02aaca'");
    expect(Number(moved[0].sort_order)).toBe(9);

    // An owner who later archives a product keeps that choice.
    await pool.query("UPDATE products SET status = 'archived' WHERE id = ?", [raw]);
    await pool.query("DELETE FROM schema_meta WHERE `key` LIKE 'data_migration:%'");
    await installSchema(pool);
    const [after] = await pool.query<RowDataPacket[]>("SELECT status FROM products WHERE id = ?", [raw]);
    expect(after[0].status).toBe("archived");
    await pool.query("UPDATE products SET status = 'published', title = 'UNAR Dehydrated Banana Chewy — Fresh Raw Banana' WHERE id = ?", [raw]);
  });

  it("enforces stock and relationship rules in the database", async () => {
    await expect(pool.query("UPDATE product_variants SET stock = -1")).rejects.toThrow();
    await expect(
      pool.query("INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES ('00000000-0000-4000-8000-000000000000', '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e01', 1)"),
    ).rejects.toThrow();
  });
});

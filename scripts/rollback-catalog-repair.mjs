/** Run only after selecting the intended database via secure environment settings. */
import mysql from "mysql2/promise";

if (process.argv[2] !== "--apply") {
  console.error("Usage: node scripts/rollback-catalog-repair.mjs --apply (after backing up the selected database)");
  process.exit(1);
}
const options = process.env.DATABASE_URL || {
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
};
if (!process.env.DATABASE_URL && (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASSWORD)) {
  throw new Error("Select the intended database through environment settings first.");
}
const conn = await mysql.createConnection(typeof options === "string" ? { uri: options, dateStrings: true, timezone: "Z" } : { ...options, dateStrings: true, timezone: "Z" });
try {
  await conn.query("SET time_zone = '+00:00'");
  const [[lock]] = await conn.query("SELECT GET_LOCK('unar_schema_install', 30) AS ok");
  if (Number(lock.ok) !== 1) throw new Error("Another database operation is running; retry later.");
  await conn.beginTransaction();
  try {
    const [rows] = await conn.query("SELECT `value` FROM schema_meta WHERE `key` = 'catalog_launch_v1_backup' FOR UPDATE");
    const backup = JSON.parse(rows[0]?.value || "[]");
    let restored = 0;
    for (const p of backup) {
      const [[current]] = await conn.query("SELECT status, published_at, updated_at FROM products WHERE id = ? FOR UPDATE", [p.id]);
      if (!current || current.status !== "published" || current.published_at !== p.repaired_at || current.updated_at !== p.repaired_at) continue;
      await conn.query("UPDATE products SET status = ?, published_at = ?, updated_at = ? WHERE id = ?", [p.status, p.published_at, p.updated_at, p.id]);
      for (const image of p.images || []) {
        await conn.query("UPDATE product_images SET sort_order = ? WHERE id = ? AND product_id = ? AND sort_order = ?", [image.sort_order, image.id, p.id, image.new_sort_order]);
      }
      restored++;
    }
    // Keep the migration marker so a redeploy does not repeat publication.
    await conn.commit();
    console.log(`Restored ${restored} untouched product(s). Owner edits were preserved.`);
  } catch (error) { await conn.rollback(); throw error; }
} finally {
  await conn.query("SELECT RELEASE_LOCK('unar_schema_install')").catch(() => undefined);
  await conn.end();
}

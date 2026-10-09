import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTableSql, keyName } from "@/lib/db/ddl";
import { parseOrder, parseQuery, parseSelect } from "@/lib/db/rest/parse";
import { readAccess } from "@/lib/db/rest/policies";
import { TABLES } from "@/lib/db/schema";
import { fromDb, toDb, toSqlDateTime } from "@/lib/db/values";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("query reader", () => {
  it("reads nested selects with aliases and inner joins", () => {
    expect(parseSelect("id, total:total_paise, order_items ( title, product_variants(sku) ), orders!inner(user_id)")).toEqual([
      { kind: "column", name: "id", alias: "id" },
      { kind: "column", name: "total_paise", alias: "total" },
      {
        kind: "embed",
        relation: "order_items",
        alias: "order_items",
        hint: undefined,
        inner: false,
        children: [
          { kind: "column", name: "title", alias: "title" },
          { kind: "embed", relation: "product_variants", alias: "product_variants", hint: undefined, inner: false, children: [{ kind: "column", name: "sku", alias: "sku" }] },
        ],
      },
      { kind: "embed", relation: "orders", alias: "orders", hint: undefined, inner: true, children: [{ kind: "column", name: "user_id", alias: "user_id" }] },
    ]);
  });

  it("reads filters, lists, or-groups and embedded filters", () => {
    const q = parseQuery(
      new URLSearchParams([
        ["select", "id"],
        ["status", "eq.published"],
        ["sku", 'in.("A,1",B)'],
        ["provider_order_id", "not.is.null"],
        ["or", "(email.ilike.%a%,phone.ilike.*9*)"],
        ["orders.user_id", "eq.u1"],
        ["order", "created_at.desc,id"],
        ["limit", "10"],
      ]),
    );
    expect(q.filters.get("")).toEqual([
      { kind: "cond", column: "status", op: "eq", negate: false, value: "published" },
      { kind: "cond", column: "sku", op: "in", negate: false, value: ["A,1", "B"] },
      { kind: "cond", column: "provider_order_id", op: "is", negate: true, value: "null" },
      {
        kind: "or",
        negate: false,
        items: [
          { kind: "cond", column: "email", op: "ilike", negate: false, value: "%a%" },
          { kind: "cond", column: "phone", op: "ilike", negate: false, value: "%9%" },
        ],
      },
    ]);
    expect(q.filters.get("orders")).toEqual([{ kind: "cond", column: "user_id", op: "eq", negate: false, value: "u1" }]);
    expect(q.order.get("")).toEqual([
      { column: "created_at", ascending: false },
      { column: "id", ascending: true },
    ]);
    expect(q.limit.get("")).toBe(10);
  });

  it("rejects anything that isn't a plain column name", () => {
    expect(() => parseSelect("id; DROP TABLE orders")).toThrow();
    expect(() => parseOrder("created_at desc")).not.toThrow(); // whitespace is ignored
    expect(() => parseQuery(new URLSearchParams([["id`", "eq.1"]]))).toThrow();
    expect(() => parseQuery(new URLSearchParams([["id", "regex.1"]]))).toThrow();
  });
});

describe("access rules", () => {
  it("visitors never see private tables", () => {
    for (const table of ["orders", "profiles", "auth_users", "carts", "payments", "staff_members"]) {
      expect(readAccess({ kind: "anon" }, table, "t")).toBe(false);
    }
    expect(readAccess({ kind: "anon" }, "products", "t")).toEqual({ sql: "t.status = 'published'", params: [] });
  });
});

describe("database values", () => {
  it("stores times in UTC and reads them back as ISO", () => {
    expect(toSqlDateTime("2026-10-09T05:30:00+05:30")).toBe("2026-10-09 00:00:00.000");
    expect(toSqlDateTime("2026-10-09 00:00:00")).toBe("2026-10-09 00:00:00.000");
    expect(fromDb({ type: "datetime" }, "2026-10-09 00:00:00.000")).toBe("2026-10-09T00:00:00.000Z");
  });

  it("converts booleans and JSON", () => {
    expect(toDb({ type: "bool" }, true)).toBe(1);
    expect(fromDb({ type: "bool" }, 0)).toBe(false);
    expect(toDb({ type: "json" }, ["a"])).toBe('["a"]');
    expect(fromDb({ type: "json" }, '{"a":1}')).toEqual({ a: 1 });
    expect(fromDb({ type: "json" }, '"text"')).toBe("text");
  });
});

describe("schema", () => {
  it("creates tables with keys, rules and no foreign keys yet", () => {
    const sql = createTableSql("product_variants", TABLES.product_variants);
    expect(sql).toContain("`stock` INT NOT NULL DEFAULT 0");
    expect(sql).toContain("CHECK (`stock` >= 0)");
    expect(sql).toContain("UNIQUE KEY `uq_product_variants_sku`");
    expect(sql).not.toContain("FOREIGN KEY");
    expect(keyName("ix", "a".repeat(40), ["b".repeat(40)]).length).toBeLessThanOrEqual(64);
  });

  it("generated types list every column (run npm run db:types after changing schema.ts)", () => {
    const types = readFileSync("src/lib/db/database.types.ts", "utf8");
    for (const [name, table] of Object.entries(TABLES)) {
      const start = types.indexOf(`"${name}": {`);
      expect(start, name).toBeGreaterThan(-1);
      const row = types.slice(start, types.indexOf("\n", types.indexOf("Row:", start)));
      for (const [col, def] of Object.entries(table.columns)) if (!def.hidden) expect(row, `${name}.${col}`).toContain(`"${col}"`);
    }
  });
});

describe("passwords", () => {
  it("are hashed with a salt and verified", async () => {
    const a = await hashPassword("Secret123");
    const b = await hashPassword("Secret123");
    expect(a).not.toBe(b);
    expect(a).not.toContain("Secret123");
    expect(await verifyPassword("Secret123", a)).toBe(true);
    expect(await verifyPassword("secret123", a)).toBe(false);
    expect(await verifyPassword("Secret123", "plain")).toBe(false);
  });
});

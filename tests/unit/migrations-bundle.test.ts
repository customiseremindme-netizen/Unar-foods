import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildBundle } from "../../scripts/bundle-migrations.mjs";

describe("supabase/setup/all-migrations.sql", () => {
  it("is up to date with supabase/migrations (run `npm run db:bundle`)", () => {
    const file = fs.readFileSync(path.resolve(import.meta.dirname, "../../supabase/setup/all-migrations.sql"), "utf8");
    expect(file).toBe(buildBundle());
  });
  it("never contains demo/seed data", () => {
    const file = fs.readFileSync(path.resolve(import.meta.dirname, "../../supabase/setup/all-migrations.sql"), "utf8");
    expect(file).not.toContain("LOCAL DEMO STOCK");
    expect(file).not.toContain("is_demo_stock = true");
  });
});

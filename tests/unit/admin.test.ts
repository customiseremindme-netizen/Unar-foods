import { describe, expect, it } from "vitest";
import { resolveRange } from "@/lib/admin/date-range";
import { publicPathFor } from "@/lib/admin/content-paths";
import { parseSetting, settingsSchemas } from "@/lib/settings/schema";

describe("report date ranges (India time)", () => {
  it("custom ranges start at IST midnight and include the last day", () => {
    const r = resolveRange({ range: "custom", from: "2026-10-01", to: "2026-10-07" });
    expect(r.from.toISOString()).toBe("2026-09-30T18:30:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-07T18:30:00.000Z");
  });
  it("invalid or reversed ranges fall back to the last 30 days", () => {
    expect(resolveRange({ range: "custom", from: "2026-10-07", to: "2026-10-01" }).key).toBe("30d");
    expect(resolveRange({ range: "custom", from: "nope", to: "2026-10-01" }).key).toBe("30d");
  });
  it("very long custom ranges are refused", () => {
    expect(resolveRange({ range: "custom", from: "2020-01-01", to: "2026-10-01" }).key).toBe("30d");
  });
});

describe("settings", () => {
  it("bad stored values fall back to safe defaults instead of breaking the site", () => {
    const theme = parseSetting("theme", { forest: "not-a-colour", olive: "#7A8F3D" });
    expect(theme.forest).toBe("#2E4E36");
    expect(theme.olive).toBe("#7A8F3D");
  });
  it("COD is off by default and GST is never assumed", () => {
    expect(parseSetting("checkout", {}).cod_enabled).toBe(false);
    expect(parseSetting("tax", {}).gst_registered).toBe(false);
  });
  it("rejects an invalid GSTIN", () => {
    expect(settingsSchemas.tax.safeParse({ gstin: "12345" }).success).toBe(false);
  });
  it("menu links must be internal paths or https", () => {
    const nav = settingsSchemas.navigation.safeParse({ header: [{ label: "Bad", href: "javascript:alert(1)" }] });
    expect(nav.success).toBe(false);
  });
});

describe("content links", () => {
  it("maps page types to their public addresses", () => {
    expect(publicPathFor("policy", "refund-policy")).toBe("/policies/refund-policy");
    expect(publicPathFor("post", "hello")).toBe("/blog/hello");
    expect(publicPathFor("page", "about")).toBe("/about");
    expect(publicPathFor("page", "wholesale")).toBe("/pages/wholesale");
  });
});

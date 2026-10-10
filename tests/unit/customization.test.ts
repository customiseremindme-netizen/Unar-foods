import { describe, it, expect } from "vitest";
import { settingsSchemas, defaultSettings, parseSetting } from "@/lib/settings/schema";
import { appearanceCss } from "@/lib/settings/appearance";
import { readSectionLayout, sectionLayoutSchema } from "@/lib/cms/layout";
import { isSectionType } from "@/lib/cms/sections";

describe("store customization", () => {
  it("preserves the existing look when older databases have no appearance row", () => {
    const appearance = parseSetting("appearance", null);
    expect(appearance.heading_font).toBe("fraunces");
    expect(appearance.content_width).toBe("standard");
    expect(appearance.shop_columns).toBe(3);
    expect(appearance.animations_enabled).toBe(true);
    expect(defaultSettings().theme.forest).toBe("#2E4E36");
  });
  it("rejects arbitrary CSS, unknown fonts and unsafe grid sizes", () => {
    for (const patch of [{ heading_font: 'Georgia;}body{display:none' }, { button_style: "custom" }, { shop_columns: 100 }]) expect(settingsSchemas.appearance.safeParse(patch).success).toBe(false);
    expect(settingsSchemas.theme.safeParse({ forest: '#000000;}body{display:none' }).success).toBe(false);
  });
  it("generates scoped settings and can disable store motion", () => {
    const css = appearanceCss(settingsSchemas.appearance.parse({ heading_font: "georgia", animations_enabled: false, content_width: "wide", shop_columns: 4 }));
    expect(css).toContain(".unar-store");
    expect(css).toContain("--site-max-width:96rem");
    expect(css).toContain("repeat(4,minmax(0,1fr))");
    expect(css).toContain("animation:none!important");
    expect(css).not.toContain(":root");
  });
  it("keeps old section styling and validates new presentation options", () => {
    expect(readSectionLayout({})).toEqual({ background: "original", spacing: "standard" });
    expect(readSectionLayout({ _layout: { background: "sage", spacing: "compact" } })).toEqual({ background: "sage", spacing: "compact" });
    expect(sectionLayoutSchema.safeParse({ background: "javascript:alert(1)" }).success).toBe(false);
    expect(isSectionType("toString")).toBe(false);
    expect(isSectionType("__proto__")).toBe(false);
  });
});

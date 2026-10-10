import type { CSSProperties } from "react";

export function AppearancePreview({ kind, value }: { kind: "appearance" | "theme"; value: Record<string, unknown> }) {
  const colour = (key: string, fallback: string) => typeof value[key] === "string" && /^#[0-9a-f]{6}$/i.test(value[key] as string) ? value[key] as string : fallback;
  const headings: Record<string, string> = { fraunces: "var(--font-fraunces), Georgia, serif", montserrat: "var(--font-montserrat), sans-serif", georgia: "Georgia, serif" };
  const corners: Record<string, string> = { pill: "9999px", soft: "0.75rem", square: "0.25rem" };
  const style: CSSProperties = kind === "theme" ? { backgroundColor: colour("cream", "#F2F1E6"), color: colour("forest", "#2E4E36") } : {};
  return <div role="region" aria-label="Appearance preview" className="rounded-2xl border border-line p-5" style={style}>
    <p className="mb-3 text-[0.7rem] uppercase tracking-widest">Preview — save to apply</p>
    <p className="text-2xl" style={{ fontFamily: headings[String(value.heading_font)] || headings.fraunces }}>One Healthy Habit a Day</p>
    <p className="mt-2 text-sm" style={{ fontFamily: value.body_font === "system" ? "system-ui, sans-serif" : "var(--font-montserrat), sans-serif" }}>A preview of your storefront text and button style.</p>
    <span className="mt-4 inline-block bg-forest px-5 py-2 text-sm text-cream" style={{ borderRadius: corners[String(value.button_style)] || corners.pill, ...(kind === "theme" ? { backgroundColor: colour("forest", "#2E4E36"), color: colour("cream", "#F2F1E6") } : {}) }}>Explore collection</span>
  </div>;
}

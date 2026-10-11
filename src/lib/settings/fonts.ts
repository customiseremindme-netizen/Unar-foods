/** A fixed, locally hosted font catalog; no arbitrary font URLs or CSS. */
export const FONT_FAMILIES = {
  fraunces: "var(--font-fraunces), Georgia, serif",
  montserrat: "var(--font-montserrat), sans-serif",
  manrope: "var(--font-manrope), sans-serif",
  inter: "var(--font-inter), sans-serif",
  dm_sans: "var(--font-dm-sans), sans-serif",
  georgia: "Georgia, serif",
  system: "system-ui, sans-serif",
};
export const FONT_PAIRINGS = [
  { id: "brand", label: "UNAR classic — Fraunces + Montserrat", heading: "fraunces", body: "montserrat" },
  { id: "natural", label: "Natural editorial — Fraunces + Manrope", heading: "fraunces", body: "manrope" },
  { id: "modern", label: "Modern shop — Manrope + Inter", heading: "manrope", body: "inter" },
  { id: "minimal", label: "Clean and minimal — Inter + Inter", heading: "inter", body: "inter" },
  { id: "friendly", label: "Soft and friendly — DM Sans + Inter", heading: "dm_sans", body: "inter" },
] as const;

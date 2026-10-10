import type { SettingsValue } from "./schema";

/** Values come from the validated settings schema, never arbitrary CSS. */
export function appearanceCss(value: SettingsValue<"appearance">) {
  const headings = { fraunces: 'var(--font-fraunces), Georgia, serif', montserrat: 'var(--font-montserrat), sans-serif', georgia: 'Georgia, serif' };
  const bodies = { montserrat: 'var(--font-montserrat), sans-serif', system: 'system-ui, sans-serif' };
  const widths = { compact: '68rem', standard: '80rem', wide: '96rem' };
  const buttons = { pill: '9999px', soft: '0.75rem', square: '0.25rem' };
  const images = { organic: '2rem', soft: '1rem', square: '0.25rem' };
  return `.unar-store{--font-display:${headings[value.heading_font]};--font-sans:${bodies[value.body_font]};--site-max-width:${widths[value.content_width]};--store-button-radius:${buttons[value.button_style]};--store-image-radius:${images[value.image_style]};font-family:var(--font-sans)}\n` +
    `@media(min-width:1024px){.unar-store .shop-product-grid{grid-template-columns:repeat(${value.shop_columns},minmax(0,1fr))}}\n` +
    (!value.animations_enabled ? `.unar-store *, .unar-store *::before, .unar-store *::after{animation:none!important;transition-duration:0s!important}.unar-store [data-reveal]{opacity:1!important;transform:none!important}.unar-store [data-product-photo]{transform:none!important}` : '');
}

/**
 * Images that ship with the website code (in /public). They can be picked
 * anywhere an image is needed, but not deleted from the dashboard.
 */
export type BundledImage = { url: string; alt: string; width: number; height: number };

const nuts = "/images/products/dry-fruits-seeds";
const raw = "/images/products/fresh-raw-banana";

export const BUNDLED_MEDIA: BundledImage[] = [
  { url: `${nuts}/01-main-hero-pouch.webp`, alt: "UNAR Banana Chewy With Dry Fruits & Seeds pouch beside bananas, almonds, cashews and seeds", width: 1254, height: 1254 },
  { url: `${nuts}/02-front-and-back-pouch.webp`, alt: "Front and back of the UNAR Banana Chewy With Dry Fruits & Seeds pouch", width: 1254, height: 1254 },
  { url: `${nuts}/03-ingredients-benefits-display.webp`, alt: "UNAR Banana Chewy With Dry Fruits & Seeds pouch with bowls of its ingredients", width: 1254, height: 1254 },
  { url: `${nuts}/04-beauty-shot-pouch.webp`, alt: "UNAR Banana Chewy With Dry Fruits & Seeds pouch on a stone stand", width: 1254, height: 1254 },
  { url: `${nuts}/05-lifestyle-support-image.webp`, alt: "UNAR Banana Chewy With Dry Fruits & Seeds served on a plate next to the pouch", width: 1254, height: 1254 },
  { url: `${raw}/01-main-hero-pouch.webp`, alt: "UNAR Banana Chewy Fresh Raw Banana pouch beside bananas", width: 1254, height: 1254 },
  { url: `${raw}/02-front-and-back-pouch.webp`, alt: "Front and back of the UNAR Banana Chewy Fresh Raw Banana pouch", width: 1254, height: 1254 },
  { url: `${raw}/03-ingredients-benefits-display.webp`, alt: "UNAR Banana Chewy Fresh Raw Banana pouch with bowls of dehydrated banana and fresh bananas", width: 1254, height: 1254 },
  { url: `${raw}/04-beauty-shot-pouch.webp`, alt: "UNAR Banana Chewy Fresh Raw Banana pouch with bananas and banana chewy slices", width: 1254, height: 1254 },
  { url: `${raw}/05-lifestyle-support-image.webp`, alt: "UNAR Banana Chewy Fresh Raw Banana served in a bowl next to the pouch", width: 1254, height: 1254 },
  { url: "/images/products/nuts-front.webp", alt: "UNAR Banana Chewy With Dry Fruits & Seeds — front label artwork", width: 2048, height: 1157 },
  { url: "/images/products/nuts-back.webp", alt: "UNAR Banana Chewy With Dry Fruits & Seeds — back label artwork", width: 1811, height: 2048 },
  { url: "/images/products/raw-front.webp", alt: "UNAR Banana Chewy Fresh Raw Banana — front label artwork", width: 2048, height: 1157 },
  { url: "/images/products/raw-back.webp", alt: "UNAR Banana Chewy Fresh Raw Banana — back label artwork", width: 1811, height: 2048 },
  { url: "/brand/unar-logo-transparent.webp", alt: "UNAR — One Healthy Habit a Day", width: 960, height: 307 },
];

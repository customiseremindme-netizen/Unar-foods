import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces, Great_Vibes, Inter, Manrope, Montserrat } from "next/font/google";
import { getPublicSettings } from "@/lib/settings";
import { getSiteUrl } from "@/lib/env";
import "./globals.css";

/** Pages read the live database, so they are rendered when visitors open them (not while building). */
export const dynamic = "force-dynamic";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

// Alternative storefront fonts are served locally and downloaded only when selected.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", preload: false });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap", preload: false });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap", preload: false });

const greatVibes = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-great-vibes",
  display: "swap",
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const { seo, store, brand } = await getPublicSettings();
  return {
    metadataBase: new URL(getSiteUrl()),
    title: { default: seo.site_title, template: seo.title_template || "%s" },
    description: seo.description,
    applicationName: store.name,
    openGraph: {
      type: "website",
      siteName: store.name,
      locale: "en_IN",
      images: seo.og_image_url ? [{ url: seo.og_image_url }] : undefined,
    },
    twitter: { card: "summary_large_image" },
    robots: seo.allow_indexing ? { index: true, follow: true } : { index: false, follow: false },
    icons: brand.favicon_url ? { icon: brand.favicon_url } : undefined,
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#F2F1E6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${montserrat.variable} ${greatVibes.variable} ${inter.variable} ${manrope.variable} ${dmSans.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}

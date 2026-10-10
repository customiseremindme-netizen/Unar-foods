import { getPublicSettings } from "@/lib/settings";
import { defaultSettings } from "@/lib/settings/schema";
import { getBanners, isPreview, listCmsPages } from "@/lib/data/content";
import { getPublishedProducts, primaryImage } from "@/lib/data/catalog";
import { isRazorpayConfigured } from "@/lib/payments/razorpay";
import { ToastProvider } from "@/components/ui/toast";
import { MotionProvider } from "@/components/motion/motion";
import { CartProvider } from "@/components/cart/cart-context";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { AnnouncementBar, PreviewBanner, SiteHeader, type SearchItem } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { LeafSprig } from "@/components/brand/botanical";

function themeCss(theme: Record<string, string>) {
  const defaults = defaultSettings().theme as Record<string, string>;
  const map: Record<string, string> = { forest: "forest", olive: "olive", cream: "cream", sage: "sage", accent: "banana" };
  const rules = Object.entries(map)
    .filter(([key]) => theme[key] && theme[key].toLowerCase() !== defaults[key]?.toLowerCase())
    .map(([key, token]) => `--color-${token}:${theme[key]};`);
  return rules.length ? `:root{${rules.join("")}}` : "";
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  let catalogUnavailable = false;
  const [settings, announcements, products, policies, preview] = await Promise.all([
    getPublicSettings(),
    getBanners("announcement"),
    getPublishedProducts().catch(() => { catalogUnavailable = true; return []; }),
    listCmsPages("policy"),
    isPreview(),
  ]);

  const logo = {
    url: settings.brand.logo_svg_url || settings.brand.logo_url,
    width: settings.brand.logo_width,
    height: settings.brand.logo_height,
    alt: settings.brand.logo_alt,
  };

  const searchIndex: SearchItem[] = products.map((p) => {
    const image = primaryImage(p);
    return {
      slug: p.slug,
      title: p.short_title ?? p.title,
      subtitle: p.subtitle,
      imageUrl: image?.url ?? null,
      imageAlt: image?.alt ?? p.title,
      pricePaise: p.defaultVariant?.price_paise ?? null,
    };
  });

  const announcement = announcements[0];
  const css = themeCss(settings.theme as unknown as Record<string, string>);
  const maintenance = settings.maintenance.enabled && !preview;

  return (
    <ToastProvider>
      <MotionProvider>
        <CartProvider>
          {css ? <style>{css}</style> : null}
          <noscript>
            <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
          </noscript>
          <a
            href="#main"
            className="sr-only z-[90] rounded-full bg-forest px-4 py-2 text-cream focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Skip to content
          </a>
          {preview ? <PreviewBanner /> : null}
          {announcement && !maintenance ? (
            <AnnouncementBar title={announcement.title} ctaLabel={announcement.cta_label} ctaUrl={announcement.cta_url} />
          ) : null}
          {catalogUnavailable ? <p role="status" className="border-b border-line bg-cream-deep px-4 py-3 text-center text-[0.85rem] text-forest">Products are temporarily unavailable. Please try again shortly.</p> : null}
          <SiteHeader
            logo={logo}
            links={settings.navigation.header}
            searchIndex={searchIndex}
            contact={{ email: settings.store.email, phone: settings.store.phone }}
          />
          <main id="main" tabIndex={-1} className="outline-none">
            {maintenance ? (
              <section className="relative overflow-hidden py-28">
                <LeafSprig className="absolute left-1/2 top-6 h-48 w-32 -translate-x-1/2 text-sage" />
                <div className="container-site relative max-w-xl pt-40 text-center">
                  <h1 className="text-[2.4rem]">We&apos;ll be right back</h1>
                  <p className="mt-4 text-muted">{settings.maintenance.message}</p>
                </div>
              </section>
            ) : (
              children
            )}
          </main>
          <SiteFooter
            data={{
              logo,
              blurb: settings.footer.blurb,
              note: settings.footer.note,
              tagline: settings.store.tagline,
              storeName: settings.store.name,
              email: settings.store.email,
              phone: settings.store.phone,
              whatsapp: settings.social.whatsapp_number,
              addressLines: settings.store.address_lines,
              fssai: settings.store.fssai_license,
              shopLinks: settings.navigation.footer_shop,
              helpLinks: settings.navigation.footer_help,
              policyLinks: policies.map((p) => ({ label: p.title, href: `/policies/${p.slug}` })),
              social: {
                instagram: settings.social.instagram_url,
                facebook: settings.social.facebook_url,
                youtube: settings.social.youtube_url,
              },
              paymentsByRazorpay: isRazorpayConfigured(),
            }}
          />
          <CartDrawer />
        </CartProvider>
      </MotionProvider>
    </ToastProvider>
  );
}

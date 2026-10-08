import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { getPublicSettings } from "@/lib/settings";
import { ContactForm } from "@/components/content/contact-form";
import { Breadcrumbs } from "@/components/ui/misc";
import { WhatsappIcon } from "@/components/brand/icons";
import { LeafSprig } from "@/components/brand/botanical";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Contact us",
  description: "Get in touch with UNAR — questions about orders, products or anything else.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const { store, social } = await getPublicSettings();
  const whatsapp = social.whatsapp_number || store.whatsapp;
  return (
    <>
      <header className="paper relative overflow-hidden border-b border-line">
        <LeafSprig className="absolute -right-2 top-4 hidden h-48 w-32 text-sage sm:block" />
        <div className="container-site relative py-12 lg:py-16">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Contact", href: "/contact" }]} />
          <h1 className="mt-6 text-[2.4rem] sm:text-[3.2rem]">We&apos;d love to hear from you</h1>
          <p className="mt-4 max-w-xl text-muted">Questions about an order, our products or anything else — send us a message.</p>
        </div>
      </header>
      <div className="container-site grid gap-12 py-12 lg:grid-cols-12 lg:py-16">
        <aside className="space-y-6 lg:col-span-4" aria-label="Contact details">
          {store.email ? (
            <a href={`mailto:${store.email}`} className="flex gap-4 rounded-[1.5rem] border border-line bg-paper p-5 transition-colors hover:border-forest">
              <Mail className="mt-1 size-5 text-olive" aria-hidden="true" />
              <span>
                <span className="block text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-olive-ink">Email</span>
                <span className="break-all text-forest">{store.email}</span>
              </span>
            </a>
          ) : null}
          {store.phone ? (
            <a href={`tel:+91${store.phone}`} className="flex gap-4 rounded-[1.5rem] border border-line bg-paper p-5 transition-colors hover:border-forest">
              <Phone className="mt-1 size-5 text-olive" aria-hidden="true" />
              <span>
                <span className="block text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-olive-ink">Phone</span>
                <span className="text-forest">+91 {store.phone}</span>
              </span>
            </a>
          ) : null}
          {whatsapp ? (
            <a
              href={`https://wa.me/91${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-4 rounded-[1.5rem] border border-line bg-paper p-5 transition-colors hover:border-forest"
            >
              <WhatsappIcon className="mt-1 size-5 text-olive" />
              <span>
                <span className="block text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-olive-ink">WhatsApp</span>
                <span className="text-forest">Chat with us</span>
              </span>
            </a>
          ) : null}
          {store.address_lines.length > 0 ? (
            <div className="flex gap-4 rounded-[1.5rem] border border-line bg-paper p-5">
              <MapPin className="mt-1 size-5 text-olive" aria-hidden="true" />
              <address className="not-italic text-[0.92rem] leading-relaxed text-muted">
                <span className="block text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-olive-ink">Address</span>
                {store.address_lines.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </address>
            </div>
          ) : null}
          {store.business_hours ? (
            <div className="flex gap-4 rounded-[1.5rem] border border-line bg-paper p-5">
              <Clock className="mt-1 size-5 text-olive" aria-hidden="true" />
              <span className="text-[0.92rem] text-muted">{store.business_hours}</span>
            </div>
          ) : null}
        </aside>
        <section className="rounded-[2rem] border border-line bg-paper p-6 sm:p-10 lg:col-span-8" aria-labelledby="form-heading">
          <h2 id="form-heading" className="mb-8 text-[1.8rem]">
            Send a message
          </h2>
          <ContactForm />
        </section>
      </div>
    </>
  );
}

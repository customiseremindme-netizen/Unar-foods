import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Logo, type LogoConfig } from "@/components/brand/logo";
import { LeafSprig } from "@/components/brand/botanical";
import { FacebookIcon, InstagramIcon, WhatsappIcon, YoutubeIcon } from "@/components/brand/icons";
import type { NavLink } from "./site-header";

export type FooterData = {
  logo: LogoConfig;
  blurb: string;
  note: string;
  tagline: string;
  storeName: string;
  email: string;
  phone: string;
  whatsapp: string;
  addressLines: string[];
  fssai: string;
  shopLinks: NavLink[];
  helpLinks: NavLink[];
  policyLinks: NavLink[];
  social: { instagram: string; facebook: string; youtube: string };
  paymentsByRazorpay: boolean;
};

function FooterColumn({ title, links }: { title: string; links: NavLink[] }) {
  if (links.length === 0) return null;
  return (
    <div>
      <h2 className="eyebrow mb-4">{title}</h2>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <Link href={link.href} className="link-underline text-[0.9rem] text-graphite hover:text-forest">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter({ data }: { data: FooterData }) {
  const year = new Date().getFullYear();
  const socials = [
    { href: data.social.instagram, label: "Instagram", Icon: InstagramIcon },
    { href: data.social.facebook, label: "Facebook", Icon: FacebookIcon },
    { href: data.social.youtube, label: "YouTube", Icon: YoutubeIcon },
    { href: data.whatsapp ? `https://wa.me/91${data.whatsapp}` : "", label: "WhatsApp", Icon: WhatsappIcon },
  ].filter((s) => s.href);

  return (
    <footer className="relative mt-24 overflow-hidden border-t border-line bg-paper">
      <LeafSprig className="absolute -right-6 top-6 hidden h-64 w-40 text-sage/70 md:block" />
      <div className="container-site relative grid gap-12 py-16 md:grid-cols-12 lg:py-20">
        <div className="md:col-span-4">
          <div className="w-[190px]">
            <Logo logo={data.logo} />
          </div>
          {data.blurb ? <p className="mt-5 max-w-xs text-[0.92rem] leading-relaxed text-muted">{data.blurb}</p> : null}
          {socials.length > 0 ? (
            <ul className="mt-6 flex gap-2" aria-label="Social media">
              {socials.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`UNAR on ${label}`}
                    className="grid size-10 place-items-center rounded-full border border-line text-forest transition-colors hover:border-forest hover:bg-forest hover:text-cream"
                  >
                    <Icon className="size-[1.05rem]" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 md:col-span-8">
          <FooterColumn title="Shop" links={data.shopLinks} />
          <FooterColumn title="Help" links={data.helpLinks} />
          <div className="col-span-2 sm:col-span-1">
            <h2 className="eyebrow mb-4">Contact</h2>
            <ul className="space-y-3 text-[0.9rem] text-graphite">
              {data.email ? (
                <li className="flex gap-2.5">
                  <Mail className="mt-1 size-4 shrink-0 text-olive" aria-hidden="true" />
                  <a href={`mailto:${data.email}`} className="link-underline break-all hover:text-forest">
                    {data.email}
                  </a>
                </li>
              ) : null}
              {data.phone ? (
                <li className="flex gap-2.5">
                  <Phone className="mt-1 size-4 shrink-0 text-olive" aria-hidden="true" />
                  <a href={`tel:+91${data.phone}`} className="link-underline hover:text-forest">
                    +91 {data.phone}
                  </a>
                </li>
              ) : null}
              {data.addressLines.length > 0 ? (
                <li className="flex gap-2.5">
                  <MapPin className="mt-1 size-4 shrink-0 text-olive" aria-hidden="true" />
                  <address className="not-italic leading-relaxed text-muted">
                    {data.addressLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </address>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>
      <div className="relative border-t border-line">
        <div className="container-site flex flex-col gap-4 py-6 text-[0.78rem] text-muted md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {data.storeName}. {data.tagline}
            {data.fssai ? <span className="ml-2">· FSSAI Lic. No. {data.fssai}</span> : null}
          </p>
          {data.policyLinks.length > 0 ? (
            <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Policies">
              {data.policyLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="link-underline hover:text-forest">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {data.paymentsByRazorpay || data.note ? (
          <div className="container-site pb-6 text-[0.75rem] text-muted">
            {data.note ? <p>{data.note}</p> : null}
            {data.paymentsByRazorpay ? <p>Online payments are processed securely by Razorpay.</p> : null}
          </div>
        ) : null}
      </div>
    </footer>
  );
}

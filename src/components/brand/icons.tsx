import {
  Award,
  Banana,
  CandyOff,
  Clock,
  DropletOff,
  FlaskConicalOff,
  HandHeart,
  Heart,
  Leaf,
  MapPin,
  Nut,
  Package,
  Recycle,
  ScanEye,
  ShieldCheck,
  Sparkles,
  Sprout,
  Sun,
  Truck,
  WheatOff,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "@/lib/cms/sections";

export const CMS_ICONS: Record<IconName, LucideIcon> = {
  leaf: Leaf,
  sprout: Sprout,
  sun: Sun,
  "scan-eye": ScanEye,
  "candy-off": CandyOff,
  "flask-off": FlaskConicalOff,
  "droplet-off": DropletOff,
  "wheat-off": WheatOff,
  heart: Heart,
  "shield-check": ShieldCheck,
  truck: Truck,
  package: Package,
  recycle: Recycle,
  sparkles: Sparkles,
  "hand-heart": HandHeart,
  banana: Banana,
  nut: Nut,
  award: Award,
  clock: Clock,
  "map-pin": MapPin,
};

export function CmsIcon({ name, className }: { name: IconName; className?: string }) {
  const Icon = CMS_ICONS[name] ?? Leaf;
  return <Icon className={className} strokeWidth={1.4} aria-hidden="true" />;
}

/* Simple outline social icons (brand marks are not included in lucide). */
export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M14.5 8H17V4.5h-2.6C11.6 4.5 10.5 6.3 10.5 8.8V11H8v3.4h2.5V21h3.4v-6.6h2.6l.5-3.4h-3.1V9.2c0-.8.3-1.2 1.1-1.2Z" strokeLinejoin="round" />
    </svg>
  );
}

export function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10.2 9.3v5.4l4.7-2.7-4.7-2.7Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M4.5 19.5l1.1-3.6A8 8 0 1 1 8.4 18.6l-3.9.9Z" strokeLinejoin="round" />
      <path d="M9.3 8.6c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .4-.1.6l-.5.6c.6 1.1 1.5 2 2.6 2.6l.6-.5c.2-.2.4-.2.6-.1l1.5.6c.3.1.4.3.4.5v.5c0 .3-.1.6-.4.7-.6.4-1.5.5-2.4.2-2.1-.7-3.8-2.4-4.5-4.5-.3-.9-.2-1.8.2-2.4Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

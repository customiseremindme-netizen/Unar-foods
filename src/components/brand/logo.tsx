import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type LogoConfig = { url: string; width: number; height: number; alt: string };

/**
 * The official UNAR logo, displayed from the uploaded artwork — never
 * re-typed or redrawn. A replacement (e.g. a transparent SVG) can be uploaded
 * in Admin → Settings → Brand.
 */
export function Logo({
  logo,
  className,
  priority,
  href = "/",
}: {
  logo: LogoConfig;
  className?: string;
  priority?: boolean;
  href?: string | null;
}) {
  const isSvg = logo.url.toLowerCase().endsWith(".svg");
  const img = (
    <Image
      src={logo.url}
      alt={logo.alt}
      width={logo.width}
      height={logo.height}
      priority={priority}
      unoptimized={isSvg}
      sizes="(min-width: 1024px) 220px, 170px"
      className={cn("h-auto w-full", className)}
    />
  );
  if (!href) return img;
  return (
    <Link href={href} aria-label={`${logo.alt} — home`} className="block">
      {img}
    </Link>
  );
}

import Image from "next/image";
import Link from "next/link";
import { NotFoundContent } from "@/components/content/not-found-content";

export default function RootNotFound() {
  return (
    <main className="min-h-dvh bg-cream">
      <div className="container-site flex justify-center pt-8">
        <Link href="/" aria-label="UNAR home">
          <Image src="/brand/unar-logo-transparent.webp" alt="UNAR" width={180} height={58} priority />
        </Link>
      </div>
      <NotFoundContent />
    </main>
  );
}

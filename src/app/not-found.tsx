import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-cream p-8 text-center">
      <div>
        <h1 className="text-[2.4rem]">Page not found</h1>
        <p className="mt-3 text-muted">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/" className="mt-6 inline-block font-semibold text-forest underline">
          Go to the homepage
        </Link>
      </div>
    </main>
  );
}

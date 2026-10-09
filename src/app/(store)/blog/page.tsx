import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { listCmsPages } from "@/lib/data/content";
import { Breadcrumbs, EmptyState } from "@/components/ui/misc";
import { LeafSprig } from "@/components/brand/botanical";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Journal",
  description: "Stories, tips and news from UNAR.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const posts = await listCmsPages("post");
  return (
    <>
      <header className="paper relative overflow-hidden border-b border-line">
        <LeafSprig className="absolute -right-2 top-4 hidden h-48 w-32 text-sage sm:block" />
        <div className="container-site relative py-12 lg:py-16">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Journal", href: "/blog" }]} />
          <h1 className="mt-6 text-[2.4rem] sm:text-[3.2rem]">The UNAR Journal</h1>
          <p className="mt-4 max-w-xl text-muted">Stories, tips and news from our kitchen.</p>
        </div>
      </header>
      <div className="container-site py-12 lg:py-16">
        {posts.length === 0 ? (
          <EmptyState title="New stories coming soon" description="Our first journal posts are on their way." />
        ) : (
          <ul className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.id}>
                <Link href={`/blog/${post.slug}`} className="group block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-cream-deep">
                    {post.cover_image_url ? (
                      <Image src={post.cover_image_url} alt={post.cover_image_alt ?? ""} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                    ) : null}
                  </div>
                  <p className="mt-4 text-[0.8rem] text-muted">{formatDate(post.published_at)}</p>
                  <h2 className="mt-1 text-[1.5rem] group-hover:underline">{post.title}</h2>
                  {post.excerpt ? <p className="mt-2 line-clamp-3 text-[0.92rem] text-muted">{post.excerpt}</p> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

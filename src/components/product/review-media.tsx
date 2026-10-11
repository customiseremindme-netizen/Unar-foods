import Image from "next/image";

export type ReviewMediaItem = { id: string; mime_type: string; width: number | null; height: number | null };
export function ReviewMedia({ items }: { items: ReviewMediaItem[] }) {
  if (!items.length) return null;
  return <ul className="mt-4 flex flex-wrap gap-3" aria-label="Customer review photos and videos">
    {items.map((item) => <li key={item.id}>
      {item.mime_type === "video/mp4" ? <video src={`/review-media/${item.id}`} controls muted preload="metadata" className="max-h-64 w-64 rounded-xl" aria-label="Customer review video" /> :
        <a href={`/review-media/${item.id}`} target="_blank" rel="noopener noreferrer" aria-label="Open customer review photo in a new tab"><Image src={`/review-media/${item.id}`} alt="Customer's product review photo" width={item.width || 160} height={item.height || 160} unoptimized className="h-24 w-24 rounded-xl object-contain ring-1 ring-line" /></a>}
    </li>)}
  </ul>;
}

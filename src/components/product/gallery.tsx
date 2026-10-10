"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, Expand, ZoomIn, ZoomOut } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { swipeDirection } from "@/lib/gallery/swipe";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type GalleryImage = { id: string; url: string; alt: string; kind: string; width: number | null; height: number | null };

const KIND_LABEL: Record<string, string> = { front_label: "Front label", back_label: "Back label" };

/**
 * Product gallery. Images are shown with object-fit: contain so label
 * artwork is never cropped. Hovering zooms on desktop; the full-screen viewer
 * offers a 100% zoom for reading label text (keyboard accessible).
 */
export function ProductGallery({ images, productName }: { images: GalleryImage[]; productName: string }) {
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const [hovering, setHovering] = useState(false);
  const selectedIndex = images.length ? index % images.length : 0;
  const current = images[selectedIndex];
  const reduceMotion = useReducedMotion();
  const touchStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const suppressClick = useRef(false);

  const go = useCallback(
    (delta: number) => {
      setZoomed(false);
      setHovering(false);
      if (images.length) setIndex((i) => (i + delta + images.length) % images.length);
    },
    [images.length],
  );

  const swipeHandlers = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType !== "touch" || zoomed) return;
      touchStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      suppressClick.current = false;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (!start || start.id !== e.pointerId) return;
      const direction = swipeDirection(start, { x: e.clientX, y: e.clientY });
      if (direction && images.length > 1) { suppressClick.current = true; go(direction); }
    },
    onPointerCancel: () => { touchStart.current = null; suppressClick.current = false; },
  };

  useEffect(() => {
    if (!viewerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerOpen, go]);

  if (!current) {
    return <div className="aspect-square rounded-[2rem] bg-cream-deep" aria-label="No product images yet" />;
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row-reverse">
      <div className="relative flex-1">
        <button
          type="button"
          {...swipeHandlers}
          style={{ touchAction: "pan-y pinch-zoom" }}
          onClick={() => {
            if (suppressClick.current) { suppressClick.current = false; return; }
            setViewerOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); go(e.key === "ArrowRight" ? 1 : -1); }
          }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setOrigin(`${((e.clientX - rect.left) / rect.width) * 100}% ${((e.clientY - rect.top) / rect.height) * 100}%`);
          }}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          className="group relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-[2rem] bg-paper ring-1 ring-line"
          aria-label={`Open image viewer: ${current.alt || productName}`}
        >
          <Image
            key={current.id}
            src={current.url}
            alt={current.alt || productName}
            fill
            preload={selectedIndex === 0}
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="animate-fade-in object-contain transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ transformOrigin: origin, transform: hovering && !reduceMotion ? "scale(1.6)" : "scale(1)" }}
          />
          <span className="pointer-events-none absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-paper/90 px-3 py-1.5 text-[0.75rem] font-semibold text-forest shadow-soft backdrop-blur">
            <Expand className="size-3.5" aria-hidden="true" /> View larger
          </span>
          {KIND_LABEL[current.kind] ? (
            <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-paper/90 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-olive-ink">
              {KIND_LABEL[current.kind]} artwork
            </span>
          ) : null}
        </button>
        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-forest shadow-soft"
              aria-label="Previous image"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-forest shadow-soft"
              aria-label="Next image"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">Image {selectedIndex + 1} of {images.length}: {current.alt || productName}</p>
      {images.length > 1 ? (
        <ul className="flex gap-3 overflow-x-auto pb-1 lg:w-20 lg:flex-col lg:overflow-visible" aria-label="Product images">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button
                type="button"
                onClick={() => { setIndex(i); setZoomed(false); setHovering(false); }}
                aria-current={i === selectedIndex ? "true" : undefined}
                aria-label={`Show image ${i + 1} of ${images.length}: ${img.alt || productName}`}
                className={cn(
                  "relative block size-16 overflow-hidden rounded-xl bg-paper ring-1 transition-all lg:size-20",
                  i === selectedIndex ? "ring-2 ring-forest" : "ring-line opacity-80 hover:opacity-100",
                )}
              >
                <Image src={img.url} alt="" fill sizes="80px" className="object-contain" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Sheet
        open={viewerOpen}
        onClose={() => {
          setViewerOpen(false);
          setZoomed(false);
        }}
        side="center"
        title={<span className="font-sans text-[0.95rem] font-semibold">{`${selectedIndex + 1} / ${images.length} · ${productName}`}</span>}
        labelledBy="gallery-viewer-title"
        className="max-h-[92dvh]"
      >
        <div className="relative">
          <div {...swipeHandlers} style={{ touchAction: zoomed ? "auto" : "pan-y pinch-zoom" }} className={cn("bg-paper", zoomed ? "max-h-[70dvh] overflow-auto" : "")}>
            {zoomed && current.width && current.height ? (
              <Image
                src={current.url}
                alt={current.alt || productName}
                width={current.width}
                height={current.height}
                sizes={`${current.width}px`}
                quality={85}
                className="max-w-none"
                style={{ width: current.width, height: "auto" }}
              />
            ) : (
              <div className="relative aspect-square max-h-[70dvh] w-full">
                <Image src={current.url} alt={current.alt || productName} fill sizes="(min-width: 768px) 672px, 100vw" quality={85} className="object-contain" />
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
            <button type="button" onClick={() => go(-1)} className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-[0.85rem] text-forest hover:bg-forest/[0.06]">
              <ChevronLeft className="size-4" aria-hidden="true" /> Previous
            </button>
            {current.width && current.height ? (
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                aria-pressed={zoomed}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-[0.85rem] font-semibold text-forest hover:border-forest"
              >
                {zoomed ? <ZoomOut className="size-4" aria-hidden="true" /> : <ZoomIn className="size-4" aria-hidden="true" />}
                {zoomed ? "Fit to screen" : "Zoom to 100%"}
              </button>
            ) : null}
            <button type="button" onClick={() => go(1)} className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-[0.85rem] text-forest hover:bg-forest/[0.06]">
              Next <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

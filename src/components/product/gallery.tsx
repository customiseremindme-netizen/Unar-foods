"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight, Expand, Minus, Plus, ScanText, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type GalleryImage = { id: string; url: string; alt: string; kind: string; width: number | null; height: number | null };

const SWIPE_PX = 45;
const ZOOM_STEPS = [1, 2, 3.5];

/** A soft moving sheen shown until an image has loaded. */
function Shimmer({ hidden, dark = false }: { hidden: boolean; dark?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 animate-shimmer bg-[length:200%_100%] transition-opacity duration-500",
        dark
          ? "bg-[linear-gradient(110deg,transparent_30%,rgb(255_255_255/0.08)_50%,transparent_70%)]"
          : "bg-[linear-gradient(110deg,transparent_30%,rgb(255_255_255/0.55)_50%,transparent_70%)]",
        hidden && "opacity-0",
      )}
    />
  );
}

/** Tracks a horizontal swipe; vertical movement is left to the page so it still scrolls. */
function useSwipe(onSwipe: (direction: 1 | -1) => void, enabled = true) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const swipedAt = useRef(0);
  return {
    /** True right after a swipe, so the tap that ended it doesn't also count as a click. */
    justSwiped: () => Date.now() - swipedAt.current < 400,
    onPointerDown: (e: ReactPointerEvent) => {
      if (!enabled || e.pointerType === "mouse") return;
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    },
    onPointerUp: (e: ReactPointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.3) {
        swipedAt.current = Date.now();
        onSwipe(dx < 0 ? 1 : -1);
      }
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}

/**
 * Product gallery: one large image, clickable thumbnails, previous/next,
 * swipe on phones, arrow keys, hover zoom on desktop and a full-screen viewer
 * with zoom and pan. Images use object-fit: contain so pouches are never
 * cropped or stretched. Pack-label artwork is kept out of the photo strip and
 * opened separately ("Read the pack label").
 */
export function ProductGallery({ images, labels = [], productName }: { images: GalleryImage[]; labels?: GalleryImage[]; productName: string }) {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const [viewer, setViewer] = useState<{ set: "photos" | "labels"; index: number } | null>(null);
  const [zoomOrigin, setZoomOrigin] = useState<string | null>(null);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = images.length;
  const current = images[index];

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);
  const { justSwiped, ...swipe } = useSwipe((d) => go(d), count > 1);
  const markLoaded = (id: string) => setLoaded((s) => (s.has(id) ? s : new Set(s).add(id)));

  // Thumbnails: arrow keys move between them (one tab stop for the whole strip).
  const onThumbKey = (e: ReactKeyboardEvent, i: number) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next: number | null = null;
    if (e.key in keys) next = (i + keys[e.key]! + count) % count;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = count - 1;
    if (next === null) return;
    e.preventDefault();
    setIndex(next);
    thumbs.current[next]?.focus();
  };

  if (!current) {
    return <div className="aspect-square rounded-[2rem] bg-cream-deep" role="img" aria-label="No product images yet" />;
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row-reverse">
      <div className="relative min-w-0 flex-1">
        <div
          className="group relative aspect-square w-full touch-pan-y overflow-hidden rounded-[2rem] bg-paper ring-1 ring-line select-none"
          {...swipe}
          onPointerMove={(e) => {
            if (e.pointerType !== "mouse") return;
            const rect = e.currentTarget.getBoundingClientRect();
            setZoomOrigin(`${((e.clientX - rect.left) / rect.width) * 100}% ${((e.clientY - rect.top) / rect.height) * 100}%`);
          }}
          onPointerLeave={() => setZoomOrigin(null)}
        >
          {/* All images are stacked; the active one fades in, so nothing jumps while switching. */}
          {images.map((img, i) => (
            <div
              key={img.id}
              aria-hidden={i !== index}
              className={cn(
                "absolute inset-0 transition-opacity duration-500 ease-[var(--ease-out-soft)] motion-reduce:transition-none",
                i === index ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <div
                className="absolute inset-0 transition-transform duration-300 ease-out motion-reduce:transition-none"
                style={i === index && zoomOrigin ? { transform: "scale(1.6)", transformOrigin: zoomOrigin } : undefined}
              >
                <Image
                  src={img.url}
                  alt={img.alt || productName}
                  fill
                  priority={i === 0}
                  loading={i === 0 ? undefined : i === index ? "eager" : "lazy"}
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  className="object-contain"
                  draggable={false}
                  onLoad={() => markLoaded(img.id)}
                />
              </div>
            </div>
          ))}
          <Shimmer hidden={loaded.has(current.id)} />
          <button
            type="button"
            onClick={() => {
              if (!justSwiped()) setViewer({ set: "photos", index });
            }}
            className="absolute inset-0 cursor-zoom-in rounded-[2rem] focus-visible:outline-offset-[-4px]"
            aria-label={`Open full-screen view of image ${index + 1}: ${current.alt || productName}`}
          />
          <span className="pointer-events-none absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-paper/90 px-3 py-1.5 text-[0.75rem] font-semibold text-forest shadow-soft backdrop-blur">
            <Expand className="size-3.5" aria-hidden="true" /> Full screen
          </span>
          {count > 1 ? (
            <span className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-paper/90 px-3 py-1.5 text-[0.75rem] font-semibold tabular-nums text-forest shadow-soft">
              {index + 1} / {count}
            </span>
          ) : null}
          {count > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-forest shadow-soft transition-opacity hover:bg-paper lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                aria-label="Previous image"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-forest shadow-soft transition-opacity hover:bg-paper lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                aria-label="Next image"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>
        <p className="sr-only" aria-live="polite">
          {`Image ${index + 1} of ${count}: ${current.alt || productName}`}
        </p>
        {labels.length ? (
          <button
            type="button"
            onClick={() => setViewer({ set: "labels", index: 0 })}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 text-[0.82rem] font-semibold text-forest transition-colors hover:border-forest"
          >
            <ScanText className="size-4" aria-hidden="true" /> Read the pack label
          </button>
        ) : null}
      </div>

      {count > 1 ? (
        <div role="group" aria-label="Product images" className="flex gap-3 overflow-x-auto p-1 lg:w-[5.5rem] lg:flex-col lg:overflow-visible">
          {images.map((img, i) => (
            <button
              key={img.id}
              ref={(el) => {
                thumbs.current[i] = el;
              }}
              type="button"
              tabIndex={i === index ? 0 : -1}
              onClick={() => setIndex(i)}
              onKeyDown={(e) => onThumbKey(e, i)}
              aria-current={i === index ? "true" : undefined}
              aria-label={`Show image ${i + 1} of ${count}: ${img.alt || productName}`}
              className={cn(
                "relative block size-16 shrink-0 overflow-hidden rounded-xl bg-paper ring-1 transition-all duration-300 lg:size-20",
                i === index ? "ring-2 ring-forest" : "ring-line opacity-75 hover:opacity-100",
              )}
            >
              <Image src={img.url} alt="" fill sizes="80px" className="object-contain" />
            </button>
          ))}
        </div>
      ) : null}

      {viewer ? (
        <Lightbox
          images={viewer.set === "labels" ? labels : images}
          start={viewer.index}
          title={viewer.set === "labels" ? `${productName} — pack label` : productName}
          onClose={(last) => {
            if (viewer.set === "photos") setIndex(last);
            setViewer(null);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Full-screen viewer on the native <dialog> (focus stays inside, Escape
 * closes). Zoom with the +/− buttons, a click/double-tap or the mouse wheel;
 * drag to look around a zoomed image; swipe or use the arrow keys to move.
 */
function Lightbox({ images, start, title, onClose }: { images: GalleryImage[]; start: number; title: string; onClose: (index: number) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(start);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);
  const count = images.length;
  const current = images[index]!;
  const indexRef = useRef(index);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    indexRef.current = index;
    onCloseRef.current = onClose;
  });

  const go = useCallback(
    (delta: number) => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setIndex((i) => (i + delta + count) % count);
    },
    [count],
  );
  const setZoomLevel = (z: number) => {
    setZoom(z);
    if (z === 1) setPan({ x: 0, y: 0 });
  };
  const stepZoom = (dir: 1 | -1) => {
    const i = ZOOM_STEPS.indexOf(zoom);
    setZoomLevel(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, (i < 0 ? 0 : i) + dir))]!);
  };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    const handleClose = () => onCloseRef.current(indexRef.current);
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("close", handleClose);
      root.style.overflow = previous;
    };
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (zoom > 1) {
      const step = 60;
      const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      if (moves[e.key]) {
        e.preventDefault();
        setPan((p) => ({ x: p.x + moves[e.key]![0], y: p.y + moves[e.key]![1] }));
        return;
      }
    } else if (count > 1 && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      e.preventDefault();
      go(e.key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (e.key === "+" || e.key === "=") stepZoom(1);
    if (e.key === "-") stepZoom(-1);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
    if (zoom > 1) setPan({ x: d.px + dx, y: d.py + dy });
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (zoom === 1 && count > 1 && Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.3) {
      go(dx < 0 ? 1 : -1);
      return;
    }
    if (d.moved) return;
    // A click (mouse) or a double tap (touch) toggles zoom.
    const now = Date.now();
    if (e.pointerType === "mouse" || now - lastTap.current < 320) {
      setZoomLevel(zoom > 1 ? 1 : 2);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  const ctl = "grid size-11 place-items-center rounded-full bg-paper/10 text-cream ring-1 ring-cream/25 transition-colors hover:bg-paper/20 disabled:opacity-40";

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onKeyDown={onKeyDown}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-forest-deep p-0 text-cream backdrop:bg-forest-deep/60 open:animate-fade-in"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="min-w-0 truncate text-[0.9rem] font-semibold">
            <span className="tabular-nums">
              {index + 1} / {count}
            </span>{" "}
            · {title}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" className={ctl} onClick={() => stepZoom(-1)} disabled={zoom === 1} aria-label="Zoom out">
              <Minus className="size-5" aria-hidden="true" />
            </button>
            <button type="button" className={ctl} onClick={() => stepZoom(1)} disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]} aria-label="Zoom in">
              <Plus className="size-5" aria-hidden="true" />
            </button>
            <button type="button" className={ctl} onClick={() => ref.current?.close()} aria-label="Close full-screen view" autoFocus>
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          className={cn("relative min-h-0 flex-1 touch-none overflow-hidden select-none", zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
          onWheel={(e) => {
            if (Math.abs(e.deltaY) < 4) return;
            stepZoom(e.deltaY < 0 ? 1 : -1);
          }}
        >
          <div
            key={current.id}
            className="absolute inset-3 animate-fade-in transition-transform duration-200 ease-out motion-reduce:transition-none sm:inset-6"
            style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}
          >
            <Image
              src={current.url}
              alt={current.alt || title}
              fill
              sizes="100vw"
              quality={85}
              className="object-contain"
              draggable={false}
              onLoad={() => setLoaded((s) => new Set(s).add(current.id))}
            />
            <Shimmer hidden={loaded.has(current.id)} dark />
          </div>
          {count > 1 ? (
            <>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={() => go(-1)}
                className={cn(ctl, "absolute left-3 top-1/2 -translate-y-1/2 sm:left-6")}
                aria-label="Previous image"
              >
                <ChevronLeft className="size-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={() => go(1)}
                className={cn(ctl, "absolute right-3 top-1/2 -translate-y-1/2 sm:right-6")}
                aria-label="Next image"
              >
                <ChevronRight className="size-6" aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>

        <p className="px-4 pt-2 text-center text-[0.8rem] text-cream/80">{current.alt}</p>
        {count > 1 ? (
          <div className="flex justify-center gap-2 overflow-x-auto px-4 py-3" role="group" aria-label="Choose an image">
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => {
                  setZoomLevel(1);
                  setIndex(i);
                }}
                aria-current={i === index ? "true" : undefined}
                aria-label={`Image ${i + 1}: ${img.alt || title}`}
                className={cn("relative size-14 shrink-0 overflow-hidden rounded-lg bg-paper ring-2 transition", i === index ? "ring-banana" : "ring-transparent opacity-60 hover:opacity-100")}
              >
                <Image src={img.url} alt="" fill sizes="56px" className="object-contain" />
              </button>
            ))}
          </div>
        ) : (
          <div className="h-4" />
        )}
      </div>
    </dialog>
  );
}

/** Photos and a video attached to an approved review. Photos open full screen. */
export function ReviewMediaStrip({ media, author }: { media: { id: string; kind: "image" | "video"; url: string; width: number | null; height: number | null }[]; author: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const photos = media.filter((m) => m.kind === "image");
  const videos = media.filter((m) => m.kind === "video");
  if (!media.length) return null;
  const images: GalleryImage[] = photos.map((p, i) => ({ id: p.id, url: p.url, alt: `Photo ${i + 1} from ${author}'s review`, kind: "review", width: p.width, height: p.height }));
  return (
    <div className="mt-4 space-y-3">
      {photos.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Photos from this review">
          {images.map((img, i) => (
            <li key={img.id}>
              <button type="button" onClick={() => setOpen(i)} className="relative block size-20 overflow-hidden rounded-xl bg-cream-deep ring-1 ring-line" aria-label={`Open ${img.alt}`}>
                <Image src={img.url} alt="" fill sizes="80px" className="object-cover" unoptimized />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {videos.map((v) => (
        <video key={v.id} src={v.url} controls preload="metadata" playsInline className="aspect-video w-full max-w-md rounded-xl bg-forest-deep" aria-label={`Video from ${author}'s review`} />
      ))}
      {open !== null ? <Lightbox images={images} start={open} title={`Photos from ${author}`} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

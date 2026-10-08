"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible slide-over panel / modal built on the native <dialog> element
 * (focus is trapped inside, Escape closes it, background is inert).
 */
export function Sheet({
  open,
  onClose,
  title,
  side = "right",
  children,
  footer,
  className,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  side?: "right" | "left" | "center";
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => {
      document.documentElement.style.overflow = "";
      onClose();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 max-h-none max-w-none bg-transparent p-0 backdrop:bg-forest-deep/35 backdrop:backdrop-blur-[2px]",
        side === "center" ? "fixed inset-0 m-auto h-fit w-[min(42rem,calc(100%-2rem))]" : "fixed inset-y-0 h-dvh w-full sm:w-[26rem]",
        side === "right" && "left-auto right-0",
        side === "left" && "left-0 right-auto",
        "open:animate-fade-in",
      )}
    >
      <div
        className={cn(
          "flex h-full flex-col bg-paper text-graphite shadow-lift",
          side === "center" ? "max-h-[85dvh] rounded-3xl" : "",
          className,
        )}
      >
        {title !== undefined ? (
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div id={labelledBy} className="font-display text-[1.35rem] text-forest">
              {title}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-10 place-items-center rounded-full text-forest transition-colors hover:bg-forest/[0.06]"
              aria-label="Close"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer ? <div className="border-t border-line bg-paper px-5 py-4">{footer}</div> : null}
      </div>
    </dialog>
  );
}

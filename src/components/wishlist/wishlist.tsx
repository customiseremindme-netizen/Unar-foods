"use client";

import Link from "next/link";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { Heart } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { toggleWishlistAction } from "@/app/actions/wishlist";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type WishlistState = { ids: Set<string>; toggle: (productId: string, name: string) => void };
const WishlistContext = createContext<WishlistState | null>(null);

/** Holds the visitor's saved product ids for every heart button on the page. */
export function WishlistProvider({ initialIds, children }: { initialIds: string[]; children: ReactNode }) {
  const [ids, setIds] = useState(() => new Set(initialIds));
  const [, startTransition] = useTransition();
  const { notify } = useToast();
  const toggle = (productId: string, name: string) => {
    const save = !ids.has(productId);
    // Show the change at once; the server's answer follows.
    setIds((prev) => {
      const next = new Set(prev);
      if (save) next.add(productId);
      else next.delete(productId);
      return next;
    });
    startTransition(async () => {
      const result = await toggleWishlistAction(productId, save);
      setIds(new Set(result.ids));
      if (!result.ok) notify(result.message ?? "Couldn't update your wishlist.", "error");
      else notify(save ? `Saved to your wishlist: ${name}` : `Removed from your wishlist: ${name}`, "success");
    });
  };
  return <WishlistContext.Provider value={{ ids, toggle }}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  return useContext(WishlistContext);
}

/** Heart button: save / remove a product, with a small "pop" when saved. */
export function WishlistButton({
  productId,
  productName,
  className,
  size = "md",
}: {
  productId: string;
  productName: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const wishlist = useWishlist();
  if (!wishlist) return null;
  const saved = wishlist.ids.has(productId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        wishlist.toggle(productId, productName);
      }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
      className={cn(
        "grid place-items-center rounded-full bg-paper/90 text-forest shadow-soft ring-1 ring-line backdrop-blur transition-colors hover:text-danger",
        size === "sm" ? "size-9" : "size-11",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={saved ? "on" : "off"}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 18 }}
          className="grid place-items-center"
        >
          <Heart className={cn(size === "sm" ? "size-4" : "size-5", saved && "fill-danger text-danger")} aria-hidden="true" />
        </m.span>
      </AnimatePresence>
    </button>
  );
}

/** Header link with the number of saved products. */
export function WishlistLink({ className }: { className?: string }) {
  const wishlist = useWishlist();
  const count = wishlist?.ids.size ?? 0;
  return (
    <Link href="/wishlist" className={cn("relative", className)} aria-label={count ? `Wishlist (${count} saved)` : "Wishlist"}>
      <Heart className="size-5" aria-hidden="true" />
      {count ? (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-banana px-1 text-[0.65rem] font-bold leading-4 text-forest-deep">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

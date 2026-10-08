"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import {
  addToCartAction,
  applyCouponAction,
  getCartAction,
  removeCouponAction,
  updateCartItemAction,
  type CartActionResult,
  type CartState,
} from "@/app/actions/cart";
import { useToast } from "@/components/ui/toast";

type CartContextValue = {
  state: CartState | null;
  loading: boolean;
  pending: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  add: (variantId: string, quantity: number, options?: { openDrawer?: boolean }) => Promise<boolean>;
  update: (variantId: string, quantity: number) => Promise<void>;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => Promise<void>;
  refresh: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { notify } = useToast();

  const refresh = useCallback(async () => {
    try {
      setState(await getCartAction());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    (fn: () => Promise<CartActionResult>, successToast?: string) =>
      new Promise<boolean>((resolve) => {
        startTransition(async () => {
          try {
            const result = await fn();
            setState(result.state);
            if (!result.ok) notify(result.message ?? "Something went wrong.", "error");
            else if (result.message) notify(result.message, "info");
            else if (successToast) notify(successToast, "success");
            resolve(result.ok);
          } catch {
            notify("Connection problem. Please try again.", "error");
            resolve(false);
          }
        });
      }),
    [notify],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      state,
      loading,
      pending,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      add: async (variantId, quantity, options) => {
        const ok = await run(() => addToCartAction(variantId, quantity));
        if (ok && options?.openDrawer !== false) setDrawerOpen(true);
        return ok;
      },
      update: async (variantId, quantity) => {
        await run(() => updateCartItemAction(variantId, quantity), quantity === 0 ? "Removed from your cart." : undefined);
      },
      applyCoupon: (code) => run(() => applyCouponAction(code)),
      removeCoupon: async () => {
        await run(() => removeCouponAction());
      },
      refresh,
    }),
    [state, loading, pending, drawerOpen, run, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

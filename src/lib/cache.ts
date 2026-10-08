import "server-only";
import { revalidatePath } from "next/cache";

/**
 * The storefront pages are pre-built for speed. Call this after any change
 * that customers should see (products, stock, content, settings) so every
 * page is rebuilt with fresh data on its next visit.
 */
export function revalidateStorefront() {
  try {
    revalidatePath("/", "layout");
  } catch {
    // Outside a request (e.g. unit tests) there is nothing to revalidate.
  }
}

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getSupabaseEnv } from "@/lib/env";

let cached: SupabaseClient<Database> | null = null;

/**
 * Anonymous, cookie-free client for reading PUBLIC data (published products,
 * published content). Because it never reads cookies, pages that use it can
 * be statically generated and cached, which keeps the storefront fast.
 */
export function getPublicSupabase(): SupabaseClient<Database> | null {
  if (cached) return cached;
  const env = getSupabaseEnv();
  if (!env) return null;
  cached = createClient<Database>(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}

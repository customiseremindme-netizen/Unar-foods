import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getSupabaseEnv, getSupabaseSecretKey } from "@/lib/env";

export type AdminSupabase = SupabaseClient<Database>;

let cached: AdminSupabase | null = null;

/**
 * PRIVILEGED client using the secret (service-role) key. It bypasses row
 * level security, so it must only be used in trusted server code AFTER the
 * caller has been authorised (checkout, payment webhooks, carts, cron jobs).
 * Never import this from a Client Component.
 */
export function getAdminSupabase(): AdminSupabase | null {
  if (cached) return cached;
  const env = getSupabaseEnv();
  const secret = getSupabaseSecretKey();
  if (!env || !secret) return null;
  cached = createClient<Database>(env.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}

export function requireAdminSupabase(): AdminSupabase {
  const client = getAdminSupabase();
  if (!client) {
    throw new Error("Supabase is not configured. Add the Supabase environment variables.");
  }
  return client;
}

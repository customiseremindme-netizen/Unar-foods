import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db/database.types";
import { getSupabaseEnv } from "@/lib/env";

export type ServerSupabase = ReturnType<typeof createServerClient<Database>>;

/**
 * Supabase client that acts AS THE SIGNED-IN USER (row level security applies).
 * Use in Server Components, Server Actions and Route Handlers.
 * Returns null when Supabase is not configured yet.
 */
export async function createSupabaseServerClient(): Promise<ServerSupabase | null> {
  const env = getSupabaseEnv();
  if (!env) return null;
  const cookieStore = await cookies();
  return createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component where cookies are read-only.
          // The proxy refreshes sessions, so this can be safely ignored.
        }
      },
    },
  });
}

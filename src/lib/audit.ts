import "server-only";
import type { Json } from "@/lib/db/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logError } from "@/lib/monitoring";

/** Records an admin action in the audit log (who did what, when). */
export async function logAdminAction(input: {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  diff?: Record<string, unknown> | null;
}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  const { error } = await supabase.rpc("log_admin_action", {
    p_action: input.action,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId ?? "",
    p_summary: input.summary,
    p_diff: (input.diff ?? null) as Json,
  });
  if (error) logError("audit", error, { action: input.action });
}

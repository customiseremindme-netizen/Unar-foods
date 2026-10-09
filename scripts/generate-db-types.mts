/**
 * Generates src/lib/db/database.types.ts (TypeScript types for every table
 * and database function) from src/lib/db/schema.ts.
 *
 *   npm run db:types
 *
 * Run it after adding or changing a column in schema.ts. Function (rpc)
 * signatures are listed in FUNCTIONS below — update them when an rpc in
 * src/lib/db/rpc changes its arguments or result.
 */
import { readFileSync, writeFileSync } from "node:fs";
// @ts-expect-error -- run directly by Node (type stripping), not part of the app build
import { TABLES, type Column } from "../src/lib/db/schema.ts";

const OUT = new URL("../src/lib/db/database.types.ts", import.meta.url);

const FUNCTIONS = `
      "adjust_stock": { Args: { "p_delta": number,"p_note": string,"p_reason": string,"p_variant_id": string }; Returns: number },
      "admin_cancel_order": { Args: { "p_order_id": string,"p_reason": string,"p_restock": boolean }; Returns: string },
      "admin_customers": { Args: { "p_limit": number,"p_offset": number,"p_search": string }; Returns: { "created_at": string,"email": string,"full_name": string,"is_registered": boolean,"last_order_at": string,"marketing_consent": boolean,"orders_count": number,"paid_orders": number,"phone": string,"total_count": number,"total_spent_paise": number,"user_id": string }[] },
      "attach_provider_order": { Args: { "p_amount_paise": number,"p_order_id": string,"p_provider_order_id": string }; Returns: undefined },
      "check_rate_limit": { Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean },
      "cleanup_rate_limits": { Args: Record<PropertyKey, never>; Returns: undefined },
      "create_order": { Args: { "p_items": Json,"p_order": Json }; Returns: Json },
      "discard_section_drafts": { Args: { "p_page": string }; Returns: undefined },
      "log_admin_action": { Args: { "p_action": string,"p_diff": Json,"p_entity_id": string,"p_entity_type": string,"p_summary": string }; Returns: undefined },
      "mark_cod_collected": { Args: { "p_order_id": string }; Returns: undefined },
      "mark_order_paid": { Args: { "p_amount_paise": number,"p_method": string,"p_order_id": string,"p_payment_status": string,"p_provider_order_id": string,"p_provider_payment_id": string,"p_raw": Json }; Returns: string },
      "my_staff_access": { Args: Record<PropertyKey, never>; Returns: { "permissions": (string)[],"role": string }[] },
      "publish_cms_page": { Args: { "p_group_id": string }; Returns: undefined },
      "publish_sections": { Args: { "p_page": string }; Returns: undefined },
      "record_payment_failure": { Args: { "p_error_code": string,"p_error_description": string,"p_order_id": string,"p_provider_order_id": string,"p_provider_payment_id": string,"p_raw": Json }; Returns: undefined },
      "record_refund": { Args: { "p_amount_paise": number,"p_order_id": string,"p_provider": string,"p_provider_refund_id": string,"p_reason": string,"p_restock": boolean,"p_status": string }; Returns: string },
      "release_order": { Args: { "p_new_status": string,"p_order_id": string,"p_reason": string }; Returns: boolean },
      "report_coupon_usage": { Args: { "p_from": string,"p_to": string }; Returns: { "code": string,"discount_paise": number,"revenue_paise": number,"uses": number }[] },
      "report_daily_sales": { Args: { "p_from": string,"p_to": string }; Returns: { "day": string,"orders": number,"refunds_paise": number,"revenue_paise": number }[] },
      "report_product_sales": { Args: { "p_from": string,"p_to": string }; Returns: { "product_id": string,"revenue_paise": number,"sku": string,"title": string,"units": number }[] },
      "report_summary": { Args: { "p_from": string,"p_to": string }; Returns: Json },
      "set_fulfillment_status": { Args: { "p_customer_visible": boolean,"p_message": string,"p_order_id": string,"p_status": string }; Returns: undefined },
      "unpublish_cms_page": { Args: { "p_group_id": string }; Returns: undefined },
      "update_refund_status": { Args: { "p_provider_refund_id": string,"p_status": string }; Returns: undefined }`;

function tsType(col: Column): string {
  if (col.tsType) return col.tsType;
  switch (col.type) {
    case "int":
    case "bigint":
    case "serial":
    case "decimal":
      return "number";
    case "bool":
      return "boolean";
    case "json":
      return "Json";
    default:
      return "string";
  }
}

const optionalOnInsert = (col: Column) =>
  col.nullable === true || col.default !== undefined || col.now !== undefined || col.autoUuid === true || col.appDefault !== undefined;

const tables = Object.keys(TABLES)
  .sort()
  .map((name) => {
    const cols = Object.entries(TABLES[name].columns)
      .filter(([, col]) => !col.hidden)
      .sort(([a], [b]) => a.localeCompare(b));
    const row = cols.map(([c, col]) => `"${c}": ${tsType(col)}${col.nullable ? " | null" : ""}`);
    const insert = cols.map(([c, col]) =>
      col.type === "serial" ? `"${c}"?: never` : `"${c}"${optionalOnInsert(col) ? "?" : ""}: ${tsType(col)}${col.nullable ? " | null" : ""}`,
    );
    const update = cols.map(([c, col]) => (col.type === "serial" ? `"${c}"?: never` : `"${c}"?: ${tsType(col)}${col.nullable ? " | null" : ""}`));
    const table = TABLES[name];
    const relationships = Object.entries(table.columns)
      .filter(([, col]) => col.references)
      .map(([c, col]) => {
        const oneToOne = (table.primaryKey.length === 1 && table.primaryKey[0] === c) || (table.unique ?? []).some((u) => u.length === 1 && u[0] === c);
        return `{ foreignKeyName: "${name}_${c}_fkey"; columns: ["${c}"]; isOneToOne: ${oneToOne}; referencedRelation: "${col.references!.table}"; referencedColumns: ["${col.references!.column}"] }`;
      });
    return `      "${name}": {
        Row: { ${row.join("; ")} }
        ComputedFields: never
        Insert: { ${insert.join("; ")} }
        Update: { ${update.join("; ")} }
        Relationships: [${relationships.length ? `\n          ${relationships.join(",\n          ")},\n        ` : ""}]
      }`;
  })
  .join("\n");

// The helper types at the end of the file (Tables<>, TablesInsert<>, …) stay as they are.
const existing = readFileSync(OUT, "utf8");
const tail = existing.slice(existing.indexOf("type DatabaseWithoutInternals"));

const out = `// GENERATED by scripts/generate-db-types.mts from src/lib/db/schema.ts — do not edit by hand.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
${tables}
    }
    Views: { [_ in never]: never }
    Functions: {${FUNCTIONS}
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

${tail}`;

writeFileSync(OUT, out);
console.log("Wrote src/lib/db/database.types.ts");

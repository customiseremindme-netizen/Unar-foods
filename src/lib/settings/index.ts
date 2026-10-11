import "server-only";
import { cache } from "react";
import { getPublicDb, getServiceDb } from "@/lib/db/client";
import { logError } from "@/lib/monitoring";
import {
  defaultSettings,
  parseSetting,
  settingsSchemas,
  type AllSettings,
  type SettingsKey,
  type SettingsValue,
} from "./schema";

export type PublicSettings = Pick<
  AllSettings,
  | "store"
  | "brand"
  | "theme"
  | "appearance"
  | "seo"
  | "social"
  | "navigation"
  | "footer"
  | "checkout"
  | "tax"
  | "shipping"
  | "maintenance"
  | "reviews"
  | "newsletter"
  | "product_defaults"
>;

function build(rows: { key: string; value: unknown }[] | null): AllSettings {
  const out = defaultSettings() as Record<string, unknown>;
  for (const row of rows ?? []) {
    if (row.key in settingsSchemas) {
      out[row.key] = parseSetting(row.key as SettingsKey, row.value);
    }
  }
  return out as AllSettings;
}

/** Public settings (safe for any page). Falls back to defaults if unavailable. */
export const getPublicSettings = cache(async (): Promise<PublicSettings> => {
  const db = getPublicDb();
  if (!db) return build(null);
  const { data, error } = await db.from("settings").select("key, value").eq("is_public", true);
  if (error) logError("settings.public", error);
  return build(data);
});

/** All settings including private ones (server-only trusted code). */
export const getAllSettings = cache(async (): Promise<AllSettings> => {
  const db = getServiceDb();
  if (!db) return build(null);
  const { data, error } = await db.from("settings").select("key, value");
  if (error) logError("settings.all", error);
  return build(data);
});

export async function getSetting<K extends SettingsKey>(key: K): Promise<SettingsValue<K>> {
  const all = await getAllSettings();
  return all[key];
}

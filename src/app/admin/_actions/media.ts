"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { processAndStoreImage, type UploadedImage } from "@/lib/admin/media";
import { check, runAdminAction, type ActionResult } from "@/lib/admin/action";
import { logAdminAction } from "@/lib/audit";
import { requireAdminSupabase } from "@/lib/supabase/admin";

/** Uploads an image to the media library (used by every image field in the dashboard). */
export async function uploadMediaAction(formData: FormData): Promise<ActionResult<UploadedImage & { id: string }>> {
  return runAdminAction(["media.write", "products.write"], async ({ supabase, user }) => {
    const file = formData.get("file");
    const folder = String(formData.get("folder") ?? "uploads");
    const alt = String(formData.get("alt") ?? "").slice(0, 200);
    const allowSvg = formData.get("allowSvg") === "1";
    const uploaded = await processAndStoreImage(file as File, folder, { allowSvg });
    const { data } = check(
      await supabase
        .from("media_assets")
        .insert({
          url: uploaded.url,
          storage_path: uploaded.storagePath,
          mime_type: uploaded.mimeType,
          size_bytes: uploaded.sizeBytes,
          width: uploaded.width,
          height: uploaded.height,
          alt,
          uploaded_by: user.id,
        })
        .select("id")
        .single(),
    );
    await logAdminAction({ action: "media.upload", entityType: "media", entityId: data!.id, summary: `Uploaded image ${uploaded.storagePath}` });
    revalidatePath("/admin/content/media");
    return { ok: true, message: "Image uploaded.", data: { ...uploaded, id: data!.id } };
  });
}

export async function listMediaAction(): Promise<ActionResult<{ id: string; url: string; alt: string; width: number | null; height: number | null }[]>> {
  return runAdminAction(["media.write", "products.write"], async ({ supabase }) => {
    const { data } = check(
      await supabase.from("media_assets").select("id, url, alt, width, height").order("created_at", { ascending: false }).limit(200),
    );
    return { ok: true, message: null, data: data ?? [] };
  });
}

export async function updateMediaAltAction(id: string, alt: string): Promise<ActionResult> {
  return runAdminAction("media.write", async ({ supabase }) => {
    z.uuid().parse(id);
    check(await supabase.from("media_assets").update({ alt: alt.slice(0, 200) }).eq("id", id));
    revalidatePath("/admin/content/media");
    return { ok: true, message: "Saved." };
  });
}

export async function deleteMediaAction(id: string): Promise<ActionResult> {
  return runAdminAction("media.write", async ({ supabase }) => {
    z.uuid().parse(id);
    const { data } = check(await supabase.from("media_assets").select("storage_path, url").eq("id", id).single());
    await requireAdminSupabase().storage.from("media").remove([data!.storage_path]);
    check(await supabase.from("media_assets").delete().eq("id", id));
    await logAdminAction({ action: "media.delete", entityType: "media", entityId: id, summary: `Deleted image ${data!.storage_path}` });
    revalidatePath("/admin/content/media");
    return { ok: true, message: "Image deleted. Pages still using it will show a missing image until updated." };
  });
}

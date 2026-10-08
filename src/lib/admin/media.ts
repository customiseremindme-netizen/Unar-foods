import "server-only";
import sharp, { type Metadata as SharpMetadata, type Sharp } from "sharp";
import { randomToken } from "@/lib/security/tokens";
import { requireAdminSupabase } from "@/lib/supabase/admin";
import { UserFacingError } from "./action";

const MAX_BYTES = Math.floor(4.4 * 1024 * 1024);
const MAX_DIMENSION = 2400;

export type UploadedImage = { url: string; storagePath: string; width: number; height: number; mimeType: string; sizeBytes: number };

function looksLikeSafeSvg(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("<svg") &&
    !/<script|<foreignobject|\son\w+\s*=|javascript:|<iframe|<embed|<object|xlink:href\s*=\s*["']?(?!#)/.test(lower)
  );
}

/**
 * Validates and stores an image upload.
 * - Raster images are decoded and RE-ENCODED with sharp (strips metadata,
 *   neutralises disguised files) and resized to at most 2400px.
 * - SVG is accepted only for logos/icons and only if it contains no scripts.
 */
export async function processAndStoreImage(file: File, folder: string, options: { allowSvg?: boolean } = {}): Promise<UploadedImage> {
  if (!(file instanceof File) || file.size === 0) throw new UserFacingError("Please choose an image file.");
  if (file.size > MAX_BYTES) throw new UserFacingError("This image is too large. Please use an image under 4 MB.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const admin = requireAdminSupabase();
  const safeFolder = folder.replace(/[^a-z0-9/-]/gi, "").slice(0, 40) || "uploads";
  const stamp = new Date().toISOString().slice(0, 10);

  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    if (!options.allowSvg) throw new UserFacingError("SVG files can only be used for the logo.");
    const text = buffer.toString("utf8");
    if (!looksLikeSafeSvg(text)) throw new UserFacingError("This SVG contains unsupported or unsafe content.");
    const path = `${safeFolder}/${stamp}-${randomToken(9)}.svg`;
    const { error } = await admin.storage.from("media").upload(path, buffer, { contentType: "image/svg+xml", upsert: false });
    if (error) throw new UserFacingError("Upload failed. Please try again.");
    const { data } = admin.storage.from("media").getPublicUrl(path);
    const dims = text.match(/viewBox=["'][\d.\s-]+\s([\d.]+)\s([\d.]+)["']/i);
    return {
      url: data.publicUrl,
      storagePath: path,
      width: dims ? Math.round(Number(dims[1])) : 600,
      height: dims ? Math.round(Number(dims[2])) : 200,
      mimeType: "image/svg+xml",
      sizeBytes: buffer.length,
    };
  }

  let image: Sharp;
  let meta: SharpMetadata;
  try {
    image = sharp(buffer, { failOn: "error", limitInputPixels: 60_000_000 }).rotate();
    meta = await image.metadata();
  } catch {
    throw new UserFacingError("This file is not a valid image (use JPG, PNG, WebP or AVIF).");
  }
  if (!meta.format || !["jpeg", "png", "webp", "avif", "gif", "heif"].includes(meta.format)) {
    throw new UserFacingError("Unsupported image type (use JPG, PNG, WebP or AVIF).");
  }
  const hasAlpha = !!meta.hasAlpha;
  const output = await image
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86, alphaQuality: 100, effort: 5, ...(hasAlpha ? {} : { smartSubsample: true }) })
    .toBuffer({ resolveWithObject: true });

  const path = `${safeFolder}/${stamp}-${randomToken(9)}.webp`;
  const { error } = await admin.storage.from("media").upload(path, output.data, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new UserFacingError("Upload failed. Please try again.");
  const { data } = admin.storage.from("media").getPublicUrl(path);
  return {
    url: data.publicUrl,
    storagePath: path,
    width: output.info.width,
    height: output.info.height,
    mimeType: "image/webp",
    sizeBytes: output.data.length,
  };
}

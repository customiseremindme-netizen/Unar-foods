import "server-only";
import sharp, { type Metadata as SharpMetadata, type Sharp } from "sharp";
import { randomUUID } from "node:crypto";
import { randomToken } from "@/lib/security/tokens";
import { getReadyPool } from "@/lib/db/install";
import { UserFacingError } from "./action";

const MAX_BYTES = Math.floor(4.4 * 1024 * 1024);
const MAX_DIMENSION = 2400;

export type UploadedImage = { id: string; url: string; storagePath: string; width: number; height: number; mimeType: string; sizeBytes: number };

/**
 * Saves the image in the database (table media_assets). It is then served
 * from /media/<id>.<ext> by src/app/media/[file]/route.ts.
 */
async function saveImage(
  data: Buffer,
  input: { ext: "webp" | "svg"; mimeType: string; folder: string; width: number; height: number; alt: string; uploadedBy: string | null },
): Promise<UploadedImage> {
  const id = randomUUID();
  const url = `/media/${id}.${input.ext}`;
  const storagePath = `${input.folder}/${new Date().toISOString().slice(0, 10)}-${randomToken(9)}.${input.ext}`;
  const pool = await getReadyPool();
  try {
    // execute() sends the image bytes in binary form (half the size of a text query).
    await pool.execute(
      "INSERT INTO media_assets (id, url, storage_path, mime_type, size_bytes, width, height, alt, data, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, url, storagePath, input.mimeType, data.length, input.width, input.height, input.alt, data, input.uploadedBy],
    );
  } catch (error) {
    if ((error as { errno?: number }).errno === 1153) throw new UserFacingError("This image is too large for the database. Please use a smaller image.");
    throw error;
  }
  return { id, url, storagePath, width: input.width, height: input.height, mimeType: input.mimeType, sizeBytes: data.length };
}

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
export async function processAndStoreImage(
  file: File,
  folder: string,
  options: { allowSvg?: boolean; alt?: string; uploadedBy?: string | null } = {},
): Promise<UploadedImage> {
  if (!(file instanceof File) || file.size === 0) throw new UserFacingError("Please choose an image file.");
  if (file.size > MAX_BYTES) throw new UserFacingError("This image is too large. Please use an image under 4 MB.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const safeFolder = folder.replace(/[^a-z0-9/-]/gi, "").slice(0, 40) || "uploads";
  const saveAs = { folder: safeFolder, alt: (options.alt ?? "").slice(0, 200), uploadedBy: options.uploadedBy ?? null };

  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    if (!options.allowSvg) throw new UserFacingError("SVG files can only be used for the logo.");
    const text = buffer.toString("utf8");
    if (!looksLikeSafeSvg(text)) throw new UserFacingError("This SVG contains unsupported or unsafe content.");
    const dims = text.match(/viewBox=["'][\d.\s-]+\s([\d.]+)\s([\d.]+)["']/i);
    return saveImage(buffer, {
      ...saveAs,
      ext: "svg",
      mimeType: "image/svg+xml",
      width: dims ? Math.round(Number(dims[1])) : 600,
      height: dims ? Math.round(Number(dims[2])) : 200,
    });
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

  return saveImage(output.data, { ...saveAs, ext: "webp", mimeType: "image/webp", width: output.info.width, height: output.info.height });
}

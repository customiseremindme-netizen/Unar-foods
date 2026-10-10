export const MAX_REVIEW_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_REVIEW_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_REVIEW_VIDEO_BYTES = 8 * 1024 * 1024;

export function validateReviewFiles(files: { type: string; size: number }[]): string | null {
  if (!files.length || files.length > 6) return "Choose up to five photos and one video.";
  let photos = 0, videos = 0, bytes = 0;
  for (const file of files) {
    bytes += file.size;
    if (!Number.isSafeInteger(file.size) || file.size <= 0) return "Choose a non-empty file.";
    if (["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      photos++;
      if (file.size > MAX_REVIEW_PHOTO_BYTES) return "Each photo must be under 2 MB.";
    } else if (file.type === "video/mp4") {
      videos++;
      if (file.size > MAX_REVIEW_VIDEO_BYTES) return "Your MP4 video must be under 8 MB.";
    } else return "Use JPG, PNG, WebP or AVIF photos, or an MP4 video.";
  }
  if (photos > 5 || videos > 1) return "Choose up to five photos and one video.";
  if (bytes > MAX_REVIEW_UPLOAD_BYTES) return "Your files are too large.";
  return null;
}

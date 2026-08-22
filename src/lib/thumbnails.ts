import sharp from "sharp";
import { ensureStorage, resolveKey } from "@/lib/server";

/**
 * Generates a small JPEG thumbnail (max 400×400, quality 80) for a stored
 * image and returns its storage key. Returns `null` on failure (non-image
 * input, corrupt file, missing engine) so callers can fall back to serving
 * the original file as the thumbnail — never throws.
 *
 * Thumbnail key: mirrors the document key under `thumbnails/` with a `.jpg`
 * extension, e.g. `documents/2026/08/ab12.jpg` → `thumbnails/2026/08/ab12.jpg`.
 */
export async function createImageThumbnail(storageKey: string): Promise<string | null> {
  try {
    const srcAbs = resolveKey(storageKey);
    const thumbKey = storageKey
      .replace(/^documents\//, "thumbnails/")
      .replace(/\.[^.]+$/, ".jpg");
    const destAbs = resolveKey(thumbKey);
    await ensureStorage();
    await sharp(srcAbs)
      .rotate() // respect EXIF orientation
      .resize(400, 400, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(destAbs);
    return thumbKey;
  } catch {
    return null;
  }
}

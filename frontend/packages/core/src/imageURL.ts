export function isImageUrl(url: string): boolean {
  return /\.(jpeg|jpg|gif|png)(\?|$)/i.test(url) && /^https?:\/\//i.test(url);
}

/** Return a usable image URL or null when missing/invalid. */
export function resolveImageUrl(image?: string | null): string | null {
  if (!image || typeof image !== "string") return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return null;
}

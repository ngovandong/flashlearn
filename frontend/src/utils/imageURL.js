export function isImageUrl(url) {
  return /\.(jpeg|jpg|gif|png)(\?|$)/i.test(url) && /^https?:\/\//i.test(url);
}

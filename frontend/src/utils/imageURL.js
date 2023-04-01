export async function isImageUrl(url) {
  if (url.startsWith("http")) {
    const response = await fetch(url);
    const contentType = response.headers.get("content-type");
    return contentType.startsWith("image/");
  } else {
    return false;
  }
}

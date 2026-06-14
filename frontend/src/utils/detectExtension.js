import {
  EXTENSION_ID,
  EXTENSION_PROBE_RESOURCE,
  EXTENSION_MARKER_ATTR,
} from "@constants/extension";

// The web store extension only runs on Chromium-based browsers, so there is no
// point nagging Firefox/Safari users to install it.
export function isChromiumBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const brands = navigator.userAgentData?.brands;
  if (Array.isArray(brands)) {
    return brands.some(({ brand }) =>
      /Chromium|Google Chrome|Microsoft Edge|Opera|Brave/i.test(brand)
    );
  }
  return /Chrome|Chromium|Edg|OPR/i.test(ua) && !/Firefox/i.test(ua);
}

// Fast path: the content script sets a marker attribute on <html> for our domains.
function hasDomMarker() {
  if (typeof document === "undefined") return false;
  return document.documentElement.hasAttribute(EXTENSION_MARKER_ATTR);
}

// Fallback that works even with already-published builds: try to load a
// web_accessible_resource from the extension. If it loads, it is installed.
function probeWebAccessibleResource(timeoutMs = 1500) {
  return new Promise((resolve) => {
    if (typeof Image === "undefined") {
      resolve(false);
      return;
    }
    const img = new Image();
    let settled = false;
    const finish = (installed) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(installed);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = `chrome-extension://${EXTENSION_ID}/${EXTENSION_PROBE_RESOURCE}`;
  });
}

export async function isExtensionInstalled() {
  if (!isChromiumBrowser()) return false;
  if (hasDomMarker()) return true;
  return probeWebAccessibleResource();
}

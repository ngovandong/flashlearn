// Published Chrome Web Store extension identity.
// The store URL embeds the permanent extension ID, so we derive everything from it.
export const EXTENSION_ID = "ggbakohjpcbedjablaahhcmijkoofahk";

export const EXTENSION_STORE_URL = `https://chromewebstore.google.com/detail/flashlearn-extension/${EXTENSION_ID}`;

// A web_accessible_resource declared in the extension manifest (images/* -> <all_urls>).
// We probe it to detect installs that predate the DOM-marker content script.
export const EXTENSION_PROBE_RESOURCE = "images/icon-32.png";

// DOM marker the extension content script sets on frontend domains (fast path).
export const EXTENSION_MARKER_ATTR = "data-flashlearn-extension";

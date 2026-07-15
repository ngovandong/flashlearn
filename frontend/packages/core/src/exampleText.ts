// Examples returned by the AI may be plain text or contain simple highlight
// tags (<b>, <strong>, <i>, <em>, <mark>) around the main word. We escape all
// HTML and then re-allow only those safe inline tags before rendering.
const ALLOWED_TAG = /&lt;(\/?(?:b|strong|i|em|mark))&gt;/gi;

export function sanitizeExampleHtml(text: unknown): string {
  if (!text) return "";
  const escaped = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(ALLOWED_TAG, "<$1>");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// If an example has no highlight tags, bold the main word/phrase ourselves.
export function highlightMainWord(text: unknown, word: string): string {
  const safe = sanitizeExampleHtml(text);
  if (!word || /<(b|strong|mark)>/i.test(safe)) {
    return safe;
  }
  try {
    const pattern = new RegExp(`(${escapeRegExp(word.trim())})`, "gi");
    return safe.replace(pattern, "<b>$1</b>");
  } catch {
    return safe;
  }
}

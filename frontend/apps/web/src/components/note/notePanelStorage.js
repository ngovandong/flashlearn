/**
 * Remembers whether the user manually collapsed a note panel.
 *
 * Without this, a panel would spring back open on every revisit of a lesson the
 * user has already read their note on. Only an explicit toggle is recorded —
 * until then the panel follows the default (open when a note exists).
 */

const KEY = "flashlearn_note_collapsed_v1";

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

/** `true`/`false` if the user has chosen for this target, otherwise `null`. */
export function readNoteCollapsed(targetType, targetKey) {
  const value = read()[`${targetType}:${targetKey}`];
  return typeof value === "boolean" ? value : null;
}

export function writeNoteCollapsed(targetType, targetKey, collapsed) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [`${targetType}:${targetKey}`]: collapsed }));
  } catch {
    // ignore storage failures (private mode etc.)
  }
}

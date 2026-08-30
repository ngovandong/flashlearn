/**
 * Plain-text <-> term conversion, shared by the web and mobile deck editors.
 *
 * Typing hundreds of terms one form at a time is the slow part of building a
 * deck, so both clients let the user paste (or re-edit) a whole list as text.
 */

/** Checked in order, so the multi-character dashes win over a bare comma. */
const SEPARATORS = ["\t", " - ", " — ", " – ", " = ", "=", ";", ","];

export interface ParsedTermLine {
  name: string;
  meaning: string;
}

/** Split one "term <sep> meaning" line; a line with no separator is name-only. */
function parseLine(line: string): ParsedTermLine {
  const separator = SEPARATORS.find((s) => line.includes(s));
  if (!separator) return { name: line.trim(), meaning: "" };
  const index = line.indexOf(separator);
  return {
    name: line.slice(0, index).trim(),
    meaning: line.slice(index + separator.length).trim(),
  };
}

/**
 * Parse pasted text into terms, one per line. Blank lines and lines without a
 * name are always dropped; repeated names are dropped unless `dedupe` is off
 * (bulk-editing existing terms needs every line to stay aligned with its row).
 */
export function parseTermLines(
  text: string,
  { dedupe = true }: { dedupe?: boolean } = {}
): ParsedTermLine[] {
  const seen = new Set<string>();
  const terms: ParsedTermLine[] = [];
  for (const line of (text || "").split("\n")) {
    if (!line.trim()) continue;
    const parsed = parseLine(line);
    const key = parsed.name.toLowerCase();
    if (!parsed.name || (dedupe && seen.has(key))) continue;
    seen.add(key);
    terms.push(parsed);
  }
  return terms;
}

/** How many lines `parseTermLines` threw away — surfaced as a hint in the UI. */
export function countSkippedTermLines(text: string): number {
  const lines = (text || "").split("\n").filter((line) => line.trim()).length;
  return lines - parseTermLines(text).length;
}

/** Render terms as editable text — the inverse of `parseTermLines`. */
export function formatTermLines(terms: ParsedTermLine[]): string {
  return terms.map((t) => `${t.name} = ${t.meaning || ""}`.trimEnd()).join("\n");
}

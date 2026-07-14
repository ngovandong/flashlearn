import React from "react";

// Shared word/phrase highlighting used by both the Speaking Coach and the Course
// lesson transcript. A span that is both user-noted and one of the user's saved
// terms is merged into a single "both" mark; otherwise only non-overlapping
// spans are rendered (longest span wins on a tie).

const isWordChar = (ch) => /[a-z0-9']/i.test(ch || "");

// Compute non-overlapping highlight ranges for a line of text.
//   highlights:  [{ text, note }]   — user-noted phrases ("note")
//   termMatches: [{ name, term_id, deck_id }] — the user's saved terms ("term")
// Each returned mark: { start, end, types: Set<"note"|"term"> }.
export function buildMarks(text, highlights = [], termMatches = []) {
  const lower = (text || "").toLowerCase();
  const byRange = new Map();
  const addOccurrences = (phrase, type) => {
    const needle = (phrase || "").toLowerCase().trim();
    if (!needle) return;
    let from = 0;
    for (;;) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      const end = idx + needle.length;
      if (!isWordChar(lower[idx - 1]) && !isWordChar(lower[end])) {
        const key = `${idx}:${end}`;
        const existing = byRange.get(key);
        if (existing) existing.types.add(type);
        else byRange.set(key, { start: idx, end, types: new Set([type]) });
      }
      from = end;
    }
  };
  (highlights || []).forEach((h) => addOccurrences(h.text, "note"));
  (termMatches || []).forEach((m) => addOccurrences(m.name, "term"));
  const marks = [...byRange.values()].sort(
    (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start)
  );
  const out = [];
  let lastEnd = 0;
  for (const m of marks) {
    if (m.start >= lastEnd) {
      out.push(m);
      lastEnd = m.end;
    }
  }
  return out;
}

// Render a line of text with its highlight marks as React nodes. Every mark
// (note, term, or both) opens the vocabulary popup via onMarkClick so the user
// can manage it (study / remove / re-highlight) from one place.
//   onMarkClick(segment, fullText)
export function renderMarkedText(text, { highlights, termMatches, onMarkClick }) {
  const marks = buildMarks(text, highlights, termMatches);
  if (!marks.length) return text;
  const nodes = [];
  let cursor = 0;
  marks.forEach((m, i) => {
    if (m.start > cursor) nodes.push(text.slice(cursor, m.start));
    const segment = text.slice(m.start, m.end);
    const isNote = m.types.has("note");
    const isTerm = m.types.has("term");
    const cls = `sc-hl${isNote ? " sc-hl--note" : ""}${isTerm ? " sc-hl--term" : ""}`;
    const title =
      isNote && isTerm
        ? "Highlighted & saved — click to manage"
        : isNote
        ? "Your highlight — click to view"
        : "Saved term — click to manage";
    nodes.push(
      <mark
        key={`m${i}`}
        className={cls}
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          onMarkClick?.(segment, text);
        }}
      >
        {segment}
      </mark>
    );
    cursor = m.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

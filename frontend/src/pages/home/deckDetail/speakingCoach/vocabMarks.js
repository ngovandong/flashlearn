import React from "react";

// Shared word/phrase highlighting used by both the Speaking Coach and the Course
// lesson transcript: user-noted highlights win over saved-term matches when they
// overlap, and only non-overlapping spans are rendered.

const isWordChar = (ch) => /[a-z0-9']/i.test(ch || "");

// Compute non-overlapping highlight ranges for a line of text.
//   highlights:  [{ text, note }]   — user-noted phrases (rendered as "note")
//   termMatches: [{ name, term_id, deck_id }] — the user's saved terms ("term")
export function buildMarks(text, highlights = [], termMatches = []) {
  const lower = (text || "").toLowerCase();
  const marks = [];
  const addOccurrences = (phrase, type, payload) => {
    const needle = (phrase || "").toLowerCase().trim();
    if (!needle) return;
    let from = 0;
    for (;;) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      const end = idx + needle.length;
      if (!isWordChar(lower[idx - 1]) && !isWordChar(lower[end])) {
        marks.push({ start: idx, end, type, payload });
      }
      from = end;
    }
  };
  (highlights || []).forEach((h) => addOccurrences(h.text, "note", h));
  (termMatches || []).forEach((m) => addOccurrences(m.name, "term", m));
  // Earliest first; on ties prefer notes, then the longest span.
  marks.sort(
    (a, b) =>
      a.start - b.start ||
      (a.type === b.type ? 0 : a.type === "note" ? -1 : 1) ||
      b.end - b.start - (a.end - a.start)
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

// Render a line of text with its highlight marks as React nodes.
//   onNoteClick(segment, fullText) — a noted highlight was clicked
//   onTermClick(payload)           — a saved-term underline was clicked
export function renderMarkedText(text, { highlights, termMatches, onNoteClick, onTermClick }) {
  const marks = buildMarks(text, highlights, termMatches);
  if (!marks.length) return text;
  const nodes = [];
  let cursor = 0;
  marks.forEach((m, i) => {
    if (m.start > cursor) nodes.push(text.slice(cursor, m.start));
    const segment = text.slice(m.start, m.end);
    if (m.type === "note") {
      nodes.push(
        <mark
          key={`n${i}`}
          className="sc-hl sc-hl--note"
          title={m.payload.note ? `Note: ${m.payload.note}` : "Your highlight — click to view"}
          onClick={(e) => {
            e.stopPropagation();
            onNoteClick?.(segment, text);
          }}
        >
          {segment}
        </mark>
      );
    } else {
      nodes.push(
        <mark
          key={`t${i}`}
          className="sc-hl sc-hl--term"
          title="Saved term — open to study"
          onClick={(e) => {
            e.stopPropagation();
            onTermClick?.(m.payload);
          }}
        >
          {segment}
        </mark>
      );
    }
    cursor = m.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

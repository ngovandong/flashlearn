import React from "react";

// Render a plain-text string with the user's saved highlights marked inline.
// Only non-overlapping, whole-word matches are marked; clicking a mark reopens
// the vocab popup for that phrase. Mirrors the Writing Coach's note highlights
// but with grammar (gr-) classes and note-only (no term/error types).

const isWordChar = (ch) => /[a-z0-9']/i.test(ch || "");

function buildMarks(text, highlights) {
  const lower = (text || "").toLowerCase();
  const marks = [];
  (highlights || []).forEach((h) => {
    const needle = (h.text || "").toLowerCase().trim();
    if (!needle) return;
    let from = 0;
    for (;;) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      const end = idx + needle.length;
      if (!isWordChar(lower[idx - 1]) && !isWordChar(lower[end])) {
        marks.push({ start: idx, end, payload: h });
      }
      from = end;
    }
  });
  // Earliest first; on ties prefer the longest span, then drop overlaps.
  marks.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
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

export function renderWithHighlights(text, highlights, onNoteClick) {
  const marks = buildMarks(text, highlights);
  if (!marks.length) return text;
  const nodes = [];
  let cursor = 0;
  marks.forEach((m, i) => {
    if (m.start > cursor) nodes.push(text.slice(cursor, m.start));
    const segment = text.slice(m.start, m.end);
    nodes.push(
      <mark
        key={i}
        className="gr-hl"
        title={m.payload.note ? `Note: ${m.payload.note}` : "Your highlight — click to view"}
        onClick={(e) => {
          e.stopPropagation();
          onNoteClick?.(segment);
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

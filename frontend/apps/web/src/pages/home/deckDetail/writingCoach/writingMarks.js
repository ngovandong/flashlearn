import React from "react";

// Word/phrase highlighting for the Writing Coach: user-noted highlights win over
// saved-term matches when they overlap, and only non-overlapping spans render.
// Mirrors the Speaking Coach's vocabMarks but uses the wc- class prefix.

const isWordChar = (ch) => /[a-z0-9']/i.test(ch || "");

// Compute non-overlapping highlight ranges for a piece of text.
//   highlights:  [{ text, note }]                 — user-noted phrases ("note")
//   termMatches: [{ name, term_id, deck_id }]      — the user's saved terms ("term")
//   corrections: [{ text, type, issue, suggestion }] — draft mistakes ("error")
export function buildMarks(text, { highlights = [], termMatches = [], corrections = [] } = {}) {
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
  (corrections || []).forEach((c) => addOccurrences(c.text, "error", c));
  (highlights || []).forEach((h) => addOccurrences(h.text, "note", h));
  (termMatches || []).forEach((m) => addOccurrences(m.name, "term", m));
  // Earliest first; on ties prefer errors, then notes, then the longest span.
  const rank = { error: 0, note: 1, term: 2 };
  marks.sort(
    (a, b) =>
      a.start - b.start ||
      rank[a.type] - rank[b.type] ||
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

// Render text with its highlight marks as React nodes.
//   onNoteClick(segment, fullText) — a noted highlight was clicked
//   onTermClick(payload)           — a saved-term underline was clicked
//   onErrorClick(payload)          — a draft correction was clicked
export function renderMarkedText(
  text,
  { highlights, termMatches, corrections, onNoteClick, onTermClick, onErrorClick } = {}
) {
  const marks = buildMarks(text, { highlights, termMatches, corrections });
  if (!marks.length) return text;
  const nodes = [];
  let cursor = 0;
  marks.forEach((m, i) => {
    if (m.start > cursor) nodes.push(text.slice(cursor, m.start));
    const segment = text.slice(m.start, m.end);
    if (m.type === "error") {
      nodes.push(
        <mark
          key={`e${i}`}
          className={`wc-hl wc-hl--error wc-hl--${m.payload.type || "style"}`}
          title={m.payload.issue ? `${m.payload.issue}` : "Suggestion — click to view"}
          onClick={(e) => {
            e.stopPropagation();
            onErrorClick?.(m.payload);
          }}
        >
          {segment}
        </mark>
      );
    } else if (m.type === "note") {
      nodes.push(
        <mark
          key={`n${i}`}
          className="wc-hl wc-hl--note"
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
          className="wc-hl wc-hl--term"
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

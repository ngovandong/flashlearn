import React from "react";
import { Text } from "react-native-paper";
import type { StyleProp, TextStyle } from "react-native";

// Generic word/phrase highlighting shared by the Speaking Coach and Writing
// Coach screens — a native equivalent of the web `vocabMarks.js` /
// `writingMarks.js` helpers (mobile has no text-selection gesture, so every
// word is individually tappable instead).

const isWordChar = (ch: string) => /[a-z0-9']/i.test(ch || "");

export interface TextMark {
  /** Phrase to find (case-insensitive, whole-word match). */
  text: string;
  /** Foreground color for the tinted span. */
  color: string;
  /** Background tint for the span. */
  tint: string;
  /** Called instead of `onWordPress` when this specific mark is tapped. */
  onPress?: (segment: string) => void;
}

interface Range {
  start: number;
  end: number;
  mark: TextMark;
}

function buildRanges(text: string, marks: TextMark[]): Range[] {
  const lower = text.toLowerCase();
  const found: Range[] = [];
  marks.forEach((mark) => {
    const needle = (mark.text || "").toLowerCase().trim();
    if (!needle) return;
    let from = 0;
    for (;;) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      const end = idx + needle.length;
      if (!isWordChar(lower[idx - 1]) && !isWordChar(lower[end])) {
        found.push({ start: idx, end, mark });
      }
      from = end;
    }
  });
  found.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const out: Range[] = [];
  let lastEnd = 0;
  for (const r of found) {
    if (r.start >= lastEnd) {
      out.push(r);
      lastEnd = r.end;
    }
  }
  return out;
}

/**
 * Renders `text` with any matching `marks` tinted, and (optionally) every
 * remaining word individually tappable for a quick vocabulary lookup.
 */
export function MarkedText({
  text,
  marks = [],
  onWordPress,
  style,
}: {
  text: string;
  marks?: TextMark[];
  onWordPress?: (word: string) => void;
  style?: StyleProp<TextStyle>;
}) {
  if (!text) return null;
  const ranges = buildRanges(text, marks);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  const pushPlain = (segment: string) => {
    if (!onWordPress) {
      if (segment) nodes.push(<Text key={key++}>{segment}</Text>);
      return;
    }
    segment.split(/(\s+)/).forEach((tok) => {
      if (!tok) return;
      key += 1;
      if (/^\s+$/.test(tok)) {
        nodes.push(<Text key={key}>{tok}</Text>);
        return;
      }
      const clean = tok.replace(/^[^\w']+|[^\w']+$/g, "");
      if (clean.length >= 2) {
        nodes.push(
          <Text key={key} onPress={() => onWordPress(clean)} suppressHighlighting>
            {tok}
          </Text>
        );
      } else {
        nodes.push(<Text key={key}>{tok}</Text>);
      }
    });
  };

  ranges.forEach((r) => {
    if (r.start > cursor) pushPlain(text.slice(cursor, r.start));
    const segment = text.slice(r.start, r.end);
    key += 1;
    nodes.push(
      <Text
        key={key}
        onPress={() => (r.mark.onPress ? r.mark.onPress(segment) : onWordPress?.(segment))}
        suppressHighlighting
        style={{ backgroundColor: r.mark.tint, color: r.mark.color, fontWeight: "700" }}
      >
        {segment}
      </Text>
    );
    cursor = r.end;
  });
  if (cursor < text.length) pushPlain(text.slice(cursor));

  return <Text style={style}>{nodes}</Text>;
}

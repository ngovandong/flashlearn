/**
 * Study notes: the document schema and the palette shared by web and mobile.
 *
 * A note body is a ProseMirror/TipTap document, validated server-side against
 * the same node/mark allowlist the editor produces. Colors travel as palette
 * *names* rather than CSS values so each client resolves them against its own
 * light/dark theme — see `resolveNoteColor`.
 */

export type NoteTargetType =
  | "course_lesson"
  | "listening_exercise"
  | "speaking_session"
  | "writing_session"
  | "grammar_unit";

export interface NoteDoc {
  type: "doc";
  content?: NoteNode[];
}

export interface NoteNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: NoteNode[];
}

export interface Note {
  id: string;
  target_type: NoteTargetType;
  target_key: string;
  content: NoteDoc;
  title?: string;
  target_url?: string;
  updated_at?: string;
}

export const EMPTY_NOTE_DOC: NoteDoc = { type: "doc", content: [] };

export const NOTE_COLORS = ["red", "orange", "green", "blue", "purple", "gray"] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

/** Human labels for the feature filter chips on the notes hub. */
export const NOTE_TARGET_LABELS: Record<NoteTargetType, string> = {
  course_lesson: "Course",
  listening_exercise: "Listening",
  speaking_session: "Speaking",
  writing_session: "Writing",
  grammar_unit: "Grammar",
};

/**
 * Hue for each palette name, as `[light, dark]` pairs.
 *
 * These are the one place the note palette is defined. They are deliberately
 * static semantic hues (a "red" note must stay red under every brand palette),
 * but each has a dark-mode variant so text keeps its contrast.
 */
const NOTE_HUES: Record<NoteColor, [string, string]> = {
  red: ["#d1344b", "#ff8095"],
  orange: ["#b4620a", "#ffb057"],
  green: ["#1c7c4a", "#5fd497"],
  blue: ["#1668c4", "#71b6ff"],
  purple: ["#7040c9", "#bda0ff"],
  gray: ["#6b7280", "#a3aab8"],
};

export function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === "string" && (NOTE_COLORS as readonly string[]).includes(value);
}

/** The text color for a palette name in the given mode. */
export function resolveNoteColor(color: NoteColor, mode: "light" | "dark"): string {
  return NOTE_HUES[color][mode === "dark" ? 1 : 0];
}

/** A translucent wash of the same hue, for the highlight mark's background. */
export function resolveNoteHighlight(color: NoteColor, mode: "light" | "dark"): string {
  return `${resolveNoteColor(color, mode)}${mode === "dark" ? "40" : "33"}`;
}

/** Flatten a document to text — the same rule the backend uses for previews. */
export function noteToPlainText(doc: NoteDoc | null | undefined): string {
  const lines: string[] = [];
  collectLines(doc as NoteNode | null | undefined, lines);
  return lines.join("\n");
}

export function isNoteEmpty(doc: NoteDoc | null | undefined): boolean {
  // Matches the server's rule: a note made only of images carries no text but
  // is still worth keeping.
  return !noteToPlainText(doc) && !hasImage(doc);
}

function hasImage(node: NoteNode | null | undefined): boolean {
  if (!node) return false;
  if (node.type === "image") return true;
  return (node.content ?? []).some(hasImage);
}

function collectLines(node: NoteNode | null | undefined, lines: string[]): void {
  const children = node?.content ?? [];
  if (children.some((child) => child?.type === "text" || child?.type === "hardBreak")) {
    const line = children.map((child) => child.text ?? " ").join("").trim();
    if (line) lines.push(line);
    return;
  }
  children.forEach((child) => collectLines(child, lines));
}

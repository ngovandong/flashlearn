import React, { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { isNoteColor, resolveNoteColor, resolveNoteHighlight } from "@flashlearn/core";
import type { NoteDoc, NoteNode } from "@flashlearn/core";
import { useTokens } from "@/theme/tokens";

/**
 * Renders a saved note natively (read-only).
 *
 * The editor lives in a WebView, but a note is *displayed* far more often than
 * it is edited — inside scrolling lesson screens where a nested WebView would
 * fight the scroll view and cost a whole browser context. Walking the document
 * here keeps the common case native and instant.
 */
export function NoteContent({ doc }: { doc: NoteDoc | null | undefined }) {
  const t = useTokens();
  if (!doc?.content?.length) return null;
  return <View>{doc.content.map((node, i) => renderBlock(node, `${i}`, t, 0))}</View>;
}

type Tokens = ReturnType<typeof useTokens>;

const HEADING_SIZES: Record<number, number> = { 1: 19, 2: 17, 3: 15.5 };

function headingSize(level: unknown): number {
  return HEADING_SIZES[level as number] ?? 15;
}

function renderBlock(node: NoteNode, key: string, t: Tokens, depth: number): React.ReactNode {
  const indent = { marginLeft: depth * 14 };

  switch (node.type) {
    case "heading":
      return (
        <Text
          key={key}
          style={[
            styles.heading,
            indent,
            { color: t.neutral.text, fontSize: headingSize(node.attrs?.level) },
          ]}
        >
          {renderInline(node.content, t)}
        </Text>
      );

    case "bulletList":
    case "orderedList":
      return (
        <View key={key}>
          {(node.content ?? []).map((item, i) => (
            <View key={`${key}.${i}`} style={[styles.row, indent]}>
              <Text style={[styles.bullet, { color: t.neutral.textMuted }]}>
                {node.type === "orderedList" ? `${i + 1}.` : "•"}
              </Text>
              <View style={styles.rowBody}>
                {(item.content ?? []).map((child, j) => renderBlock(child, `${key}.${i}.${j}`, t, 0))}
              </View>
            </View>
          ))}
        </View>
      );

    case "taskList":
      return (
        <View key={key}>
          {(node.content ?? []).map((item, i) => {
            const checked = Boolean(item.attrs?.checked);
            return (
              <View key={`${key}.${i}`} style={[styles.row, indent]}>
                <MaterialCommunityIcons
                  name={checked ? "checkbox-marked" : "checkbox-blank-outline"}
                  size={17}
                  color={checked ? t.palette.primary : t.neutral.textMuted}
                  style={styles.checkbox}
                />
                <View style={styles.rowBody}>
                  {(item.content ?? []).map((child, j) => (
                    <View key={`${key}.${i}.${j}`} style={checked ? styles.done : undefined}>
                      {renderBlock(child, `${key}.${i}.${j}`, t, 0)}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      );

    case "blockquote":
      return (
        <View key={key} style={[styles.quote, indent, { borderLeftColor: t.neutral.border }]}>
          {(node.content ?? []).map((child, i) => renderBlock(child, `${key}.${i}`, t, 0))}
        </View>
      );

    case "codeBlock":
      return (
        <View key={key} style={[styles.code, indent, { backgroundColor: t.neutral.surface2 }]}>
          <Text style={[styles.codeText, { color: t.neutral.text }]}>{renderInline(node.content, t)}</Text>
        </View>
      );

    case "image":
      return <NoteImage key={key} src={String(node.attrs?.src ?? "")} borderColor={t.neutral.border} />;

    case "horizontalRule":
      return <View key={key} style={[styles.rule, { backgroundColor: t.neutral.border }]} />;

    default:
      return (
        <Text key={key} style={[styles.paragraph, indent, { color: t.neutral.text }]}>
          {renderInline(node.content, t)}
        </Text>
      );
  }
}

/**
 * A note image, sized to the width of the note.
 *
 * The intrinsic ratio is measured once so the picture keeps its shape instead
 * of being letterboxed into a guessed box, and the height is capped so a tall
 * screenshot cannot push the rest of the note off the screen.
 */
function NoteImage({ src, borderColor }: { src: string; borderColor: string }) {
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    Image.getSize(
      src,
      (width, height) => active && height > 0 && setRatio(width / height),
      () => active && setRatio(DEFAULT_IMAGE_RATIO)
    );
    return () => {
      active = false;
    };
  }, [src]);

  if (!src) return null;
  return (
    <Image
      source={{ uri: src }}
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      style={[styles.image, { borderColor, aspectRatio: ratio ?? DEFAULT_IMAGE_RATIO }]}
    />
  );
}

function renderInline(content: NoteNode[] | undefined, t: Tokens): React.ReactNode {
  return (content ?? []).map((node, i) => {
    if (node.type === "hardBreak") return "\n";
    if (node.type !== "text") return null;

    const marks = node.marks ?? [];
    const has = (type: string) => marks.some((mark) => mark.type === type);
    const colorOf = (type: string) => marks.find((mark) => mark.type === type)?.attrs?.color;

    const textColor = colorOf("textStyle");
    const highlight = colorOf("highlight");
    const decoration = [has("underline") && "underline", has("strike") && "line-through"]
      .filter(Boolean)
      .join(" ");

    return (
      <Text
        key={i}
        style={[
          has("bold") && styles.bold,
          has("italic") && styles.italic,
          has("code") && [styles.codeText, { backgroundColor: t.neutral.surface2 }],
          has("link") && { color: t.palette.primary, textDecorationLine: "underline" as const },
          decoration ? { textDecorationLine: decoration as "underline" } : null,
          isNoteColor(textColor) ? { color: resolveNoteColor(textColor, t.mode) } : null,
          isNoteColor(highlight) ? { backgroundColor: resolveNoteHighlight(highlight, t.mode) } : null,
        ]}
      >
        {node.text}
      </Text>
    );
  });
}

const DEFAULT_IMAGE_RATIO = 16 / 9;
const MAX_IMAGE_HEIGHT = 320;

const styles = StyleSheet.create({
  paragraph: { fontSize: 14.5, lineHeight: 22 },
  heading: { fontWeight: "700", lineHeight: 24, marginTop: 6, marginBottom: 2 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  rowBody: { flex: 1 },
  bullet: { fontSize: 14.5, lineHeight: 22, minWidth: 16 },
  checkbox: { marginTop: 3 },
  done: { opacity: 0.55 },
  quote: { borderLeftWidth: 3, paddingLeft: 10, marginVertical: 4 },
  code: { borderRadius: 8, padding: 10, marginVertical: 4 },
  codeText: { fontFamily: "monospace", fontSize: 13.5 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 10 },
  image: {
    width: "100%",
    maxHeight: MAX_IMAGE_HEIGHT,
    marginVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bold: { fontWeight: "700" },
  italic: { fontStyle: "italic" },
});

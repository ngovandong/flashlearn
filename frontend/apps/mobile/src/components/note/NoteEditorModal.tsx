import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Snackbar, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  RichText,
  TenTapStartKit,
  Toolbar,
  useBridgeState,
  useEditorBridge,
} from "@10play/tentap-editor";
import { NOTE_COLORS, resolveNoteColor, resolveNoteHighlight } from "@flashlearn/core";
import type { NoteColor, NoteDoc } from "@flashlearn/core";
import { noteApi } from "@/api/services";
import { PressableScale } from "@/components/PressableScale";
import { useTokens } from "@/theme/tokens";

interface Props {
  visible: boolean;
  title: string;
  content: NoteDoc;
  onClose: () => void;
  onSave: (content: NoteDoc) => void;
}

/**
 * Full-screen note editor.
 *
 * Editing happens on its own screen rather than inline: the editor is a WebView,
 * and embedding one in a lesson's scroll view means two competing scrollers and
 * a keyboard that covers the text being typed.
 */
export function NoteEditorModal({ visible, title, content, onClose, onSave }: Props) {
  const t = useTokens();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editor = useEditorBridge({
    bridgeExtensions: TenTapStartKit,
    initialContent: content as object,
    avoidIosKeyboard: true,
    autofocus: true,
  });

  // The webview ships its own light stylesheet, so the app's surface, text and
  // note palette have to be pushed in once the editor is up.
  useEffect(() => {
    if (!visible) return;
    editor.injectCSS(buildEditorCss(t), "flashlearn-note");
  }, [visible, editor, t]);

  const save = async () => {
    onSave((await editor.getJSON()) as NoteDoc);
  };

  /**
   * Pick a picture and insert it once it is hosted.
   *
   * A note only stores images on our own CDN, so the upload has to finish
   * before the URL goes into the document — hence the wait rather than an
   * optimistic local `file://` insert.
   */
  const addImage = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;

    setUploading(true);
    try {
      const name = asset.fileName || asset.uri.split("/").pop() || "note.jpg";
      const res = await noteApi.uploadImage({
        uri: asset.uri,
        name,
        type: asset.mimeType || "image/jpeg",
      });
      const url = res.data?.url;
      if (!url) throw new Error("no url");
      editor.setImage(url);
    } catch {
      setError("That image couldn't be added.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: t.neutral.bg }]} edges={["top", "bottom"]}>
        <View style={[styles.header, { borderBottomColor: t.neutral.border }]}>
          <PressableScale onPress={onClose} hitSlop={10}>
            <Text style={{ color: t.neutral.textMuted, fontSize: 15 }}>Cancel</Text>
          </PressableScale>
          <Text numberOfLines={1} style={[styles.title, { color: t.neutral.text }]}>
            {title}
          </Text>
          <PressableScale onPress={save} hitSlop={10}>
            <Text style={{ color: t.palette.primary, fontSize: 15, fontWeight: "700" }}>Done</Text>
          </PressableScale>
        </View>

        <RichText editor={editor} style={styles.editor} />
        <NoteColorBar editor={editor} onAddImage={addImage} uploading={uploading} />
        <Toolbar editor={editor} />
        <Snackbar visible={!!error} onDismiss={() => setError(null)} duration={3000}>
          {error}
        </Snackbar>
      </SafeAreaView>
    </Modal>
  );
}

/**
 * Palette row above the standard toolbar.
 *
 * Colors are sent as palette *names* — that is exactly what the backend stores,
 * and the injected CSS maps each name to the themed hue inside the webview.
 */
function NoteColorBar({
  editor,
  onAddImage,
  uploading,
}: {
  editor: ReturnType<typeof useEditorBridge>;
  onAddImage: () => void;
  uploading: boolean;
}) {
  const t = useTokens();
  const state = useBridgeState(editor);
  const [mode, setMode] = useState<"text" | "highlight">("text");

  const apply = (color: NoteColor) => {
    if (mode === "text") editor.setColor(color);
    else editor.toggleHighlight(color);
  };

  const clear = () => {
    if (mode === "text") editor.unsetColor();
    else editor.unsetHighlight();
  };

  const activeColor = mode === "text" ? state.activeColor : state.activeHighlight;

  return (
    <View style={[styles.colorBar, { borderTopColor: t.neutral.border, backgroundColor: t.neutral.surface }]}>
      <Pressable onPress={onAddImage} disabled={uploading} hitSlop={8}>
        {uploading ? (
          <ActivityIndicator size="small" color={t.palette.primary} />
        ) : (
          <MaterialCommunityIcons name="image-outline" size={20} color={t.palette.primary} />
        )}
      </Pressable>
      <Pressable onPress={() => setMode(mode === "text" ? "highlight" : "text")} hitSlop={8}>
        <MaterialCommunityIcons
          name={mode === "text" ? "format-color-text" : "marker"}
          size={20}
          color={t.palette.primary}
        />
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatches}>
        {NOTE_COLORS.map((color) => (
          <Pressable
            key={color}
            onPress={() => apply(color)}
            hitSlop={6}
            style={[
              styles.swatch,
              {
                backgroundColor:
                  mode === "text" ? resolveNoteColor(color, t.mode) : resolveNoteHighlight(color, t.mode),
                borderColor: activeColor === color ? t.neutral.text : "transparent",
              },
            ]}
          />
        ))}
        <Pressable onPress={clear} hitSlop={6} style={[styles.swatch, styles.swatchNone, { borderColor: t.neutral.border }]}>
          <MaterialCommunityIcons name="format-color-marker-cancel" size={15} color={t.neutral.textMuted} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function buildEditorCss(t: ReturnType<typeof useTokens>): string {
  // TipTap renders a text color as `style="color: <name>"` and a highlight as
  // `<mark data-color="<name>">`. Both are overridden here so a note shows the
  // app's tuned hue in the active mode instead of the raw CSS keyword.
  const palette = NOTE_COLORS.map(
    (color) => `
      span[style*="color: ${color}"] { color: ${resolveNoteColor(color, t.mode)} !important; }
      mark[data-color="${color}"] {
        background-color: ${resolveNoteHighlight(color, t.mode)} !important;
        color: inherit !important;
      }`
  ).join("\n");

  return `
    body, .ProseMirror {
      background-color: ${t.neutral.bg};
      color: ${t.neutral.text};
      font-size: 16px;
      line-height: 1.6;
    }
    .ProseMirror a { color: ${t.palette.primary}; }
    .ProseMirror blockquote { border-left: 3px solid ${t.neutral.border}; padding-left: 12px; }
    .ProseMirror code, .ProseMirror pre { background-color: ${t.neutral.surface2}; border-radius: 6px; }
    .ProseMirror ul[data-type="taskList"] input { accent-color: ${t.palette.primary}; }
    .ProseMirror p.is-editor-empty:first-child::before { color: ${t.neutral.textMuted}; }
    ${palette}
  `;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "700" },
  editor: { flex: 1 },
  colorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  swatches: { flexDirection: "row", alignItems: "center", gap: 10 },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2 },
  swatchNone: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
});

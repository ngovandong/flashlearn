import React, { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import type { Term } from "@flashlearn/core";
import { resolveImageUrl } from "@flashlearn/core";
import { imageApi, termApi, translateApi } from "@/api/services";
import { uploadImageToCloudinary } from "@/utils/cloudinaryUpload";
import { PressableScale } from "@/components/PressableScale";
import { GradientButton } from "@/components/ui/GradientButton";
import { unwrap } from "@/utils/apiError";
import { useTokens, type Tokens } from "@/theme/tokens";

const EMPTY_TERM: Term = { name: "", meaning: "", image: "" };

/** Small outlined action chip (Translate / AI fill / Find image). */
function ActionChip({
  label,
  icon,
  onPress,
  loading,
  disabled,
  t,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  t: Tokens;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.actionChip,
        { borderColor: t.neutral.border, borderRadius: t.radii.pill, opacity: disabled || loading ? 0.5 : 1 },
      ]}
    >
      <MaterialIcons name={(loading ? "hourglass-empty" : icon) as any} size={16} color={t.palette.primary} />
      <Text style={{ color: t.palette.primary, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </PressableScale>
  );
}

/**
 * Add or edit one term. Saving writes straight to the API, so a deck with
 * hundreds of terms never holds a screenful of unsaved edits.
 */
export default function TermEditorSheet({
  visible,
  deckId,
  term,
  onClose,
  onSaved,
  onError,
}: {
  visible: boolean;
  deckId: string;
  /** The term being edited, or null to add a new one. */
  term: Term | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const t = useTokens();
  const [draft, setDraft] = useState<Term>(EMPTY_TERM);
  const [imageResults, setImageResults] = useState<string[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const isNew = !draft.id;

  useEffect(() => {
    if (visible) {
      setDraft({ ...EMPTY_TERM, ...(term ?? {}) });
      setImageResults([]);
    }
  }, [visible, term]);

  const translate = async () => {
    if (!draft.name?.trim()) return;
    try {
      const data = unwrap<{ translation?: string }>(await translateApi.translate(draft.name.trim()));
      if (data.translation) setDraft((d) => ({ ...d, meaning: data.translation! }));
    } catch {
      onError("Couldn't translate this term. Please try again.");
    }
  };

  const searchImage = async () => {
    if (!draft.name?.trim()) return;
    setImageLoading(true);
    try {
      const data = unwrap<{ urls?: string[] }>(await imageApi.search(draft.name.trim()));
      const urls = data.urls ?? [];
      setImageResults(urls);
      if (urls[0]) setDraft((d) => ({ ...d, image: urls[0] }));
    } catch {
      onError("Couldn't load images. Please try again.");
    } finally {
      setImageLoading(false);
    }
  };

  const pickAndUploadImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onError("Photo library access is required to upload an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;

    setImageUploading(true);
    try {
      const url = await uploadImageToCloudinary(result.assets[0].uri);
      setDraft((d) => ({ ...d, image: url }));
    } catch {
      onError("Image upload failed. Please try again.");
    } finally {
      setImageUploading(false);
    }
  };

  const aiFill = async () => {
    if (!draft.name?.trim()) return;
    setAiLoading(true);
    try {
      const data = unwrap<Partial<Term>>(await termApi.aiEnrich(draft.name.trim(), draft.meaning ?? ""));
      setDraft((d) => ({
        ...d,
        ...data,
        meaning: d.meaning || data.definition || "",
        ai_filled: true,
      }));
    } catch {
      onError("The AI request failed. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const save = async (addAnother = false) => {
    const name = draft.name?.trim();
    if (!name) return;
    setSaving(true);
    try {
      const payload = { ...draft, name, meaning: draft.meaning ?? "" };
      if (draft.id) {
        unwrap(await termApi.updateTerms([payload]));
      } else {
        unwrap(await termApi.addTermsToDeck(deckId, [payload]));
      }
      onSaved(draft.id ? "Term updated" : "Term added");
      if (addAnother) {
        setDraft(EMPTY_TERM);
        setImageResults([]);
      } else {
        onClose();
      }
    } catch {
      onError("Couldn't save this term. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const previewUrl = resolveImageUrl(draft.image);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: t.neutral.surface, borderTopLeftRadius: t.radii.xl, borderTopRightRadius: t.radii.xl }]}>
          <View style={styles.head}>
            <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800" }}>
              {isNew ? "Add a term" : "Edit term"}
            </Text>
            <PressableScale onPress={onClose} hitSlop={10} style={styles.iconBtn}>
              <MaterialIcons name="close" size={22} color={t.neutral.textMuted} />
            </PressableScale>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <TextInput
              label="Term"
              mode="outlined"
              value={draft.name ?? ""}
              onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
              outlineStyle={{ borderRadius: t.radii.md }}
              style={styles.input}
            />
            <TextInput
              label="Meaning"
              mode="outlined"
              value={draft.meaning ?? ""}
              onChangeText={(v) => setDraft((d) => ({ ...d, meaning: v }))}
              multiline
              outlineStyle={{ borderRadius: t.radii.md }}
              style={[styles.input, { marginTop: 8 }]}
            />

            <View style={styles.actionRow}>
              <ActionChip label="Translate" icon="translate" onPress={translate} t={t} disabled={!draft.name?.trim()} />
              <ActionChip
                label={draft.ai_filled ? "AI filled" : "AI fill"}
                icon="auto-fix-high"
                onPress={aiFill}
                loading={aiLoading}
                disabled={!draft.name?.trim()}
                t={t}
              />
              <ActionChip
                label="Find image"
                icon="image-search"
                onPress={searchImage}
                loading={imageLoading}
                disabled={!draft.name?.trim()}
                t={t}
              />
              <ActionChip
                label="Upload photo"
                icon="upload"
                onPress={pickAndUploadImage}
                loading={imageUploading}
                disabled={imageUploading}
                t={t}
              />
            </View>

            {previewUrl ? (
              <View style={styles.previewRow}>
                <Image source={{ uri: previewUrl }} style={[styles.preview, { borderRadius: t.radii.md }]} resizeMode="cover" />
                <PressableScale onPress={() => setDraft((d) => ({ ...d, image: "" }))} hitSlop={8} style={styles.iconBtn}>
                  <MaterialIcons name="delete-outline" size={22} color={t.neutral.textMuted} />
                </PressableScale>
              </View>
            ) : null}

            {imageResults.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
                {imageResults.map((url) => {
                  const resolved = resolveImageUrl(url);
                  if (!resolved) return null;
                  return (
                    <Pressable key={url} onPress={() => setDraft((d) => ({ ...d, image: url }))}>
                      <Image
                        source={{ uri: resolved }}
                        style={[styles.thumb, { borderColor: url === draft.image ? t.palette.primary : t.neutral.border }]}
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: t.neutral.border }]}>
            {isNew ? (
              <PressableScale onPress={() => save(true)} disabled={saving} style={styles.secondaryBtn}>
                <Text style={{ color: t.palette.primary, fontWeight: "700" }}>Save & add another</Text>
              </PressableScale>
            ) : null}
            <GradientButton
              label={isNew ? "Add term" : "Save"}
              icon="check"
              onPress={() => save(false)}
              loading={saving}
              disabled={!draft.name?.trim() || saving}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { maxHeight: "92%", paddingTop: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  body: { padding: 16, paddingTop: 8 },
  input: { backgroundColor: "transparent" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  actionChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1.5 },
  previewRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 12 },
  preview: { flex: 1, height: 160 },
  thumbRow: { gap: 8, marginTop: 12 },
  thumb: { width: 72, height: 72, borderRadius: 10, borderWidth: 2 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  secondaryBtn: { paddingHorizontal: 12, paddingVertical: 12, justifyContent: "center" },
  footer: {
    flexDirection: "row",
    gap: 8,
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

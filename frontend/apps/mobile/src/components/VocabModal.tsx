import React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { PressableScale } from "@/components/PressableScale";
import { useTokens, type Tokens } from "@/theme/tokens";

// Vocabulary lookup bottom sheet shared by the Speaking Coach and Writing
// Coach screens (mirrors the web `vocabModal.js` used by both features).
// Extracted here — rather than duplicated per screen — because the two
// callers need the same shape (meaning fields, optional highlight, optional
// saved-term status, save-to-deck); the grammar unit screen keeps its own
// inline copy since it has no highlight/term-match concept identical to this
// one and this task doesn't touch that screen.

export interface VocabField {
  label: string;
  value: string;
}

export interface VocabSelection {
  text: string;
  context?: string;
  loading?: boolean;
  error?: string;
  fields?: VocabField[];
}

export interface TermMatch {
  term_id?: string;
  name?: string;
}

export default function VocabModal({
  selected,
  highlighted = false,
  noteDraft,
  onNoteChange,
  showHighlightControls = false,
  onClose,
  onRetry,
  onListen,
  onToggleHighlight,
  onSaveTerm,
  saving = false,
  termMatch = null,
  onOpenTerm,
  onRemoveTerm,
}: {
  selected: VocabSelection | null;
  highlighted?: boolean;
  noteDraft: string;
  onNoteChange: (v: string) => void;
  showHighlightControls?: boolean;
  onClose: () => void;
  onRetry: () => void;
  onListen: (text: string) => void;
  onToggleHighlight: (remove?: boolean) => void;
  onSaveTerm: () => void;
  saving?: boolean;
  termMatch?: TermMatch | null;
  onOpenTerm?: (match: TermMatch) => void;
  onRemoveTerm?: (match: TermMatch) => void;
}) {
  const t = useTokens();
  if (!selected) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: t.neutral.surface, borderRadius: t.radii.xl }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.palette.primary, fontWeight: "700", fontSize: 12 }}>
                VOCABULARY COACH
              </Text>
              <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 2 }}>
                "{selected.text}"
              </Text>
              {termMatch ? (
                <View style={[styles.chip, { backgroundColor: t.primaryAlpha(0.12), borderRadius: t.radii.pill }]}>
                  <MaterialIcons name="bookmark-added" size={13} color={t.palette.primary} />
                  <Text style={{ color: t.palette.primary, fontWeight: "700", fontSize: 12 }}>In your deck</Text>
                </View>
              ) : null}
            </View>
            <PressableScale onPress={onClose} hitSlop={8}>
              <MaterialIcons name="close" size={22} color={t.neutral.textMuted} />
            </PressableScale>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {selected.loading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={t.palette.primary} />
                <Text style={{ color: t.neutral.textMuted, marginTop: 8 }}>Looking it up…</Text>
              </View>
            ) : selected.error ? (
              <View style={styles.loading}>
                <Text style={{ color: t.neutral.textMuted }}>{selected.error}</Text>
                <PressableScale
                  onPress={onRetry}
                  style={[styles.retryBtn, { borderColor: t.neutral.border, borderRadius: t.radii.pill }]}
                >
                  <Text style={{ color: t.palette.primary, fontWeight: "700" }}>Retry</Text>
                </PressableScale>
              </View>
            ) : (
              <>
                {(selected.fields ?? []).map((f) => (
                  <View key={f.label} style={{ marginTop: 10 }}>
                    <Text style={{ color: t.neutral.textMuted, fontWeight: "700", fontSize: 12 }}>
                      {f.label.toUpperCase()}
                    </Text>
                    <Text style={{ color: t.neutral.text, marginTop: 2 }}>{f.value || "—"}</Text>
                  </View>
                ))}

                <PressableScale
                  onPress={() => onListen(selected.text)}
                  style={[styles.pillBtnGhost, { borderColor: t.neutral.border, borderRadius: t.radii.pill, marginTop: 16 }]}
                >
                  <MaterialIcons name="volume-up" size={16} color={t.neutral.text} />
                  <Text style={{ color: t.neutral.text, fontWeight: "700" }}>Listen</Text>
                </PressableScale>

                {showHighlightControls ? (
                  <>
                    <Text style={{ color: t.neutral.textMuted, fontWeight: "700", fontSize: 12, marginTop: 16 }}>
                      HIGHLIGHT
                    </Text>
                    <TextInput
                      mode="outlined"
                      dense
                      value={noteDraft}
                      onChangeText={onNoteChange}
                      placeholder="Add a quick note (optional)…"
                      outlineStyle={{ borderRadius: t.radii.md }}
                      style={[styles.input, { marginTop: 6 }]}
                    />
                    <View style={styles.actionsRow}>
                      <PressableScale
                        onPress={() => onToggleHighlight(false)}
                        style={[
                          styles.pillBtn,
                          { backgroundColor: highlighted ? t.palette.primary : t.neutral.surface2, borderRadius: t.radii.pill },
                        ]}
                      >
                        <MaterialIcons
                          name="border-color"
                          size={16}
                          color={highlighted ? t.palette.onPrimary : t.neutral.text}
                        />
                        <Text style={{ color: highlighted ? t.palette.onPrimary : t.neutral.text, fontWeight: "700" }}>
                          {highlighted ? "Update note" : "Highlight"}
                        </Text>
                      </PressableScale>
                      {highlighted ? (
                        <PressableScale
                          onPress={() => onToggleHighlight(true)}
                          style={[styles.pillBtnGhost, { borderColor: t.neutral.border, borderRadius: t.radii.pill }]}
                        >
                          <MaterialIcons name="close" size={16} color={t.neutral.text} />
                          <Text style={{ color: t.neutral.text, fontWeight: "700" }}>Unhighlight</Text>
                        </PressableScale>
                      ) : null}
                    </View>
                  </>
                ) : null}

                <View style={[styles.actionsRow, { marginTop: 16 }]}>
                  {termMatch ? (
                    <>
                      {onOpenTerm ? (
                        <PressableScale
                          onPress={() => onOpenTerm(termMatch)}
                          style={[styles.pillBtn, { backgroundColor: t.palette.primary, borderRadius: t.radii.pill }]}
                        >
                          <MaterialIcons name="open-in-new" size={16} color={t.palette.onPrimary} />
                          <Text style={{ color: t.palette.onPrimary, fontWeight: "700" }}>Open to study</Text>
                        </PressableScale>
                      ) : null}
                      {onRemoveTerm ? (
                        <PressableScale
                          onPress={() => onRemoveTerm(termMatch)}
                          style={[styles.pillBtnGhost, { borderColor: t.neutral.border, borderRadius: t.radii.pill }]}
                        >
                          <MaterialIcons name="delete-outline" size={16} color={t.neutral.text} />
                          <Text style={{ color: t.neutral.text, fontWeight: "700" }}>Remove</Text>
                        </PressableScale>
                      ) : null}
                    </>
                  ) : (
                    <PressableScale
                      onPress={onSaveTerm}
                      disabled={saving}
                      style={[styles.pillBtn, { backgroundColor: t.palette.primary, borderRadius: t.radii.pill }]}
                    >
                      <MaterialIcons name="add" size={16} color={t.palette.onPrimary} />
                      <Text style={{ color: t.palette.onPrimary, fontWeight: "700" }}>
                        {saving ? "Saving…" : "Save as term"}
                      </Text>
                    </PressableScale>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  card: { maxHeight: "82%", padding: 20, paddingBottom: 28 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  body: { marginTop: 6 },
  loading: { alignItems: "center", paddingVertical: 20 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  input: { backgroundColor: "transparent" },
  actionsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  pillBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 11 },
  pillBtnGhost: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1.5,
  },
  retryBtn: { marginTop: 10, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1.5, alignSelf: "center" },
});

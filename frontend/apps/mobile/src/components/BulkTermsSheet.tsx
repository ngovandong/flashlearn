import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import type { Term } from "@flashlearn/core";
import { countSkippedTermLines, formatTermLines, parseTermLines } from "@flashlearn/core";
import { termApi } from "@/api/services";
import { PressableScale } from "@/components/PressableScale";
import { GradientButton } from "@/components/ui/GradientButton";
import { unwrap } from "@/utils/apiError";
import { useTokens } from "@/theme/tokens";

const PLACEHOLDER = "irrelevant - không liên quan\nflickering = nhấp nháy\nhouse,ngôi nhà";

/**
 * Terms as plain text — the fastest way to build or fix a long list on a phone.
 *
 * `mode="add"` parses pasted lines into new terms; `mode="edit"` pre-fills the
 * selected terms so they can be rewritten in place (one line per term, matched
 * by position).
 */
export default function BulkTermsSheet({
  visible,
  mode,
  deckId,
  terms = [],
  onClose,
  onSaved,
  onError,
}: {
  visible: boolean;
  mode: "add" | "edit";
  deckId: string;
  terms?: Term[];
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const t = useTokens();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setText(
        mode === "edit"
          ? formatTermLines(terms.map((t) => ({ name: t.name ?? "", meaning: t.meaning ?? "" })))
          : ""
      );
    }
  }, [visible, mode, terms]);

  const parsed = parseTermLines(text, { dedupe: mode === "add" });
  const skipped = countSkippedTermLines(text);
  const mismatch = mode === "edit" && parsed.length !== terms.length;
  const canSave = parsed.length > 0 && !mismatch;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (mode === "add") {
        unwrap(await termApi.addTermsToDeck(deckId, parsed.map((line) => ({ ...line }))));
        onSaved(`${parsed.length} term${parsed.length > 1 ? "s" : ""} added`);
      } else {
        const payload = terms.map((term, index) => ({
          ...term,
          name: parsed[index].name,
          meaning: parsed[index].meaning,
        }));
        unwrap(await termApi.updateTerms(payload));
        onSaved(`${payload.length} term${payload.length > 1 ? "s" : ""} updated`);
      }
      onClose();
    } catch {
      onError("Couldn't save these terms. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: t.neutral.surface,
              borderTopLeftRadius: t.radii.xl,
              borderTopRightRadius: t.radii.xl,
            },
          ]}
        >
          <View style={styles.head}>
            <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800" }}>
              {mode === "add" ? "Add many terms" : `Edit ${terms.length} terms as text`}
            </Text>
            <PressableScale onPress={onClose} hitSlop={10} style={styles.iconBtn}>
              <MaterialIcons name="close" size={22} color={t.neutral.textMuted} />
            </PressableScale>
          </View>

          <View style={styles.body}>
            <Text variant="bodySmall" style={{ color: t.neutral.textMinor, marginBottom: 8 }}>
              {mode === "add"
                ? "One term per line. Separate the term from its meaning with a dash, an equals sign, a comma or a tab."
                : "One term per line, written as term = meaning. Keep every line — removing one here won't delete the term."}
            </Text>
            <TextInput
              mode="outlined"
              value={text}
              onChangeText={setText}
              multiline
              numberOfLines={8}
              placeholder={mode === "add" ? PLACEHOLDER : undefined}
              outlineStyle={{ borderRadius: t.radii.md }}
              style={styles.input}
            />
            <Text
              variant="bodySmall"
              style={{ color: mismatch ? t.palette.primary : t.neutral.textMuted, marginTop: 8 }}
            >
              {mismatch
                ? `Expected ${terms.length} lines but found ${parsed.length}.`
                : `${parsed.length} term${parsed.length === 1 ? "" : "s"} ready${
                    mode === "add" && skipped > 0 ? ` · ${skipped} skipped` : ""
                  }`}
            </Text>
          </View>

          <View style={[styles.footer, { borderTopColor: t.neutral.border }]}>
            <GradientButton
              label={mode === "add" ? `Add ${parsed.length || ""} terms`.trim() : "Save changes"}
              icon="check"
              onPress={save}
              loading={saving}
              disabled={!canSave || saving}
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
  body: { paddingHorizontal: 16, paddingBottom: 8 },
  input: { backgroundColor: "transparent", minHeight: 160 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  footer: { padding: 16, paddingBottom: 28, borderTopWidth: StyleSheet.hairlineWidth },
});

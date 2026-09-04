import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EMPTY_NOTE_DOC, noteToPlainText } from "@flashlearn/core";
import type { Note, NoteDoc, NoteTargetType } from "@flashlearn/core";
import { AppCard } from "@/components/ui/AppCard";
import { PressableScale } from "@/components/PressableScale";
import { noteApi } from "@/api/services";
import { useTokens } from "@/theme/tokens";
import { NoteContent } from "./NoteContent";
import { NoteEditorModal } from "./NoteEditorModal";
import { readNoteCollapsed, writeNoteCollapsed } from "./noteCollapsedStore";

interface Props {
  targetType: NoteTargetType;
  targetKey: string | undefined;
  title?: string;
  targetUrl?: string;
  label?: string;
}

/**
 * A collapsible study note attached to a lesson, exercise or coach session.
 *
 * Collapsed when nothing has been written, open when there is a note — so the
 * card stays quiet until it has something to show. A manual collapse sticks.
 */
export function NotePanel({ targetType, targetKey, title = "", targetUrl = "", label = "My notes" }: Props) {
  const t = useTokens();
  const queryClient = useQueryClient();
  const queryKey = ["note", targetType, targetKey];
  const enabled = Boolean(targetKey);

  const { data: note, isPending } = useQuery<Note | null>({
    queryKey,
    enabled,
    queryFn: async () => {
      const res = await noteApi.forTarget(targetType, targetKey as string);
      return res.data?.note ?? null;
    },
  });

  const { mutate: saveNote, isPending: saving } = useMutation({
    mutationFn: async (content: NoteDoc) => {
      const res = await noteApi.save(targetType, targetKey as string, { content, title, targetUrl });
      return res.data?.note ?? null;
    },
    onSuccess: (saved) => queryClient.setQueryData(queryKey, saved),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const hasNote = Boolean(note);

  // Settle the initial open state once, after the note has loaded.
  const [settled, setSettled] = useState(false);
  useEffect(() => setSettled(false), [targetType, targetKey]);
  useEffect(() => {
    if (isPending || settled || !enabled) return;
    setSettled(true);
    readNoteCollapsed(targetType, targetKey as string).then((stored) => {
      setOpen(stored === null ? hasNote : !stored);
    });
  }, [isPending, settled, enabled, hasNote, targetType, targetKey]);

  if (!enabled) return null;

  const toggle = () => {
    setOpen(!open);
    writeNoteCollapsed(targetType, targetKey as string, open);
  };

  const preview = hasNote ? noteToPlainText(note!.content).replace(/\n+/g, " · ") : "";

  return (
    <AppCard style={styles.card} padding={0}>
      <PressableScale onPress={toggle} style={styles.header}>
        <MaterialCommunityIcons name="note-text-outline" size={18} color={t.palette.primary} />
        <View style={styles.headerText}>
          <Text style={[styles.label, { color: t.neutral.textMinor }]}>
            {hasNote || open ? label.toUpperCase() : "ADD A NOTE"}
          </Text>
          {!open && preview ? (
            <Text numberOfLines={1} style={[styles.preview, { color: t.neutral.textMuted }]}>
              {preview}
            </Text>
          ) : null}
        </View>
        <MaterialCommunityIcons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color={t.neutral.textMuted}
        />
      </PressableScale>

      {open ? (
        <View style={styles.body}>
          {hasNote ? (
            <NoteContent doc={note!.content} />
          ) : (
            <Text style={[styles.empty, { color: t.neutral.textMuted }]}>
              Nothing here yet. Jot down the rules, phrases or mistakes you want to remember.
            </Text>
          )}
          <View style={styles.actions}>
            <PressableScale onPress={() => setEditing(true)} hitSlop={8}>
              <Text style={{ color: t.palette.primary, fontWeight: "700", fontSize: 13 }}>
                {hasNote ? "Edit note" : "Write a note"}
              </Text>
            </PressableScale>
            {saving ? (
              <Text style={[styles.saving, { color: t.neutral.textMuted }]}>Saving…</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {editing ? (
        <NoteEditorModal
          visible
          title={title || label}
          content={note?.content ?? EMPTY_NOTE_DOC}
          onClose={() => setEditing(false)}
          onSave={(content) => {
            saveNote(content);
            setEditing(false);
          }}
        />
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    // Comfortably above the 44px tap target minimum.
    minHeight: 52,
    paddingHorizontal: 16,
  },
  headerText: { flex: 1, gap: 2 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  preview: { fontSize: 12.5 },
  body: { paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  empty: { fontSize: 13.5, lineHeight: 20 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  saving: { fontSize: 12 },
});

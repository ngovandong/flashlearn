import React, { useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text, TextInput } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Highlight, Term, WritingMessage, WritingSession } from "@flashlearn/core";
import { termApi, writingApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { GradientSurface } from "@/components/ui/GradientSurface";
import { PressableScale } from "@/components/PressableScale";
import { MarkedText, type TextMark } from "@/components/MarkedText";
import { NotePanel } from "@/components/note/NotePanel";
import VocabModal, { type VocabSelection } from "@/components/VocabModal";
import { useFloatingTabBarHeight } from "@/components/ui/FloatingTabBar";
import { speakText } from "@/utils/audio";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens, type Tokens } from "@/theme/tokens";

interface Mistake {
  text?: string;
  correction?: string;
  issue?: string;
}
interface MessageFeedback {
  hasIssues?: boolean;
  mistakes?: Mistake[];
  correctedText?: string;
  betterVersion?: string;
  tips?: string[];
  examples?: string[];
}

function messageFeedback(m: WritingMessage): MessageFeedback {
  return ((m as unknown as { feedback?: MessageFeedback }).feedback ?? {}) as MessageFeedback;
}

/** Bottom-sheet showing Dragon's feedback for one learner message (mirrors the
 * web `FeedbackPanel`, surfaced as a sheet since mobile has no two-pane layout). */
function FeedbackSheet({ message, onClose, t }: { message: WritingMessage | null; onClose: () => void; t: Tokens }) {
  if (!message) return null;
  const fb = messageFeedback(message);
  const hasMistakes = (fb.mistakes ?? []).length > 0;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: t.neutral.surface, borderRadius: t.radii.xl }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.sheetHead}>
            <Text style={{ color: t.palette.primary, fontWeight: "700", fontSize: 12, flex: 1 }}>FEEDBACK</Text>
            <PressableScale onPress={onClose} hitSlop={8}>
              <MaterialIcons name="close" size={22} color={t.neutral.textMuted} />
            </PressableScale>
          </View>
          <ScrollView style={{ marginTop: 8 }} showsVerticalScrollIndicator={false}>
            <Text style={{ color: t.neutral.textMinor, fontStyle: "italic" }}>"{message.text}"</Text>

            {!fb.hasIssues && !hasMistakes ? (
              <View style={[styles.perfectBox, { backgroundColor: t.alpha("#10b981", 0.12), borderRadius: t.radii.md }]}>
                <MaterialIcons name="check-circle-outline" size={18} color="#10b981" />
                <Text style={{ color: t.neutral.text, flex: 1 }}>Great job — this looks natural and correct!</Text>
              </View>
            ) : hasMistakes ? (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: t.neutral.textMuted, fontWeight: "700", fontSize: 12 }}>MISTAKES</Text>
                {fb.mistakes!.map((m, i) => (
                  <View key={i} style={[styles.mistake, { borderColor: t.neutral.border }]}>
                    <Text>
                      <Text style={{ color: "#d32f2f", textDecorationLine: "line-through" }}>{m.text}</Text>
                      <Text style={{ color: t.neutral.textMinor }}>{"  →  "}</Text>
                      <Text style={{ color: "#2e7d32", fontWeight: "700" }}>{m.correction}</Text>
                    </Text>
                    {m.issue ? <Text style={{ color: t.neutral.textMinor, marginTop: 4 }}>{m.issue}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}

            {fb.correctedText && fb.correctedText !== message.text ? (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: t.neutral.textMuted, fontWeight: "700", fontSize: 12 }}>CORRECTED</Text>
                <Text style={{ color: t.neutral.text, marginTop: 2 }}>{fb.correctedText}</Text>
              </View>
            ) : null}

            {fb.betterVersion ? (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: t.neutral.textMuted, fontWeight: "700", fontSize: 12 }}>SAY IT EVEN BETTER</Text>
                <Text style={{ color: t.palette.primary, marginTop: 2, fontStyle: "italic" }}>{fb.betterVersion}</Text>
              </View>
            ) : null}

            {(fb.tips ?? []).length > 0 ? (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: t.neutral.textMuted, fontWeight: "700", fontSize: 12 }}>TIPS</Text>
                {fb.tips!.map((tip, i) => (
                  <Text key={i} style={{ color: t.neutral.textMinor, marginTop: 4 }}>
                    • {tip}
                  </Text>
                ))}
              </View>
            ) : null}

            {(fb.examples ?? []).length > 0 ? (
              <View style={{ marginTop: 12, marginBottom: 8 }}>
                <Text style={{ color: t.neutral.textMuted, fontWeight: "700", fontSize: 12 }}>EXAMPLES</Text>
                {fb.examples!.map((ex, i) => (
                  <Text key={i} style={{ color: t.neutral.textMinor, marginTop: 4 }}>
                    • {ex}
                  </Text>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function WritingSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useFloatingTabBarHeight();
  const qc = useQueryClient();
  const listRef = useRef<FlatList<WritingMessage>>(null);
  const [input, setInput] = useState("");
  const [activeMessage, setActiveMessage] = useState<WritingMessage | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selected, setSelected] = useState<VocabSelection | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.writing.detail(id!),
    queryFn: async () => unwrap<WritingSession>(await writingApi.getSession(id!)),
    enabled: !!id,
  });

  React.useEffect(() => {
    if (data?.highlights) setHighlights(data.highlights);
  }, [data?.highlights]);

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await writingApi.sendMessage(id!, text);
      return unwrap(res);
    },
    onSuccess: () => {
      setInput("");
      refetch();
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    },
  });

  const restartMutation = useMutation({
    mutationFn: async () => {
      const res = await writingApi.startChat({
        topic: data?.topic || "",
        level: data?.level || "B1",
        tone: data?.tone || "casual",
      });
      return unwrap<{ id: string }>(res);
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: queryKeys.writing.history });
      if (s?.id) router.replace(`/writing/${s.id}`);
    },
  });

  const highlightMutation = useMutation({
    mutationFn: (payload: { text: string; note?: string; remove?: boolean }) =>
      writingApi.setHighlight(id!, payload),
    onSuccess: (res) => setHighlights(unwrap<{ highlights: Highlight[] }>(res).highlights ?? []),
  });

  const saveTermMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const payload: Term = {
        name: selected.text,
        meaning: selected.fields?.find((f) => f.label === "Meaning")?.value ?? "",
        ai_filled: true,
      };
      return unwrap(await termApi.addToDefaultDeck(payload));
    },
    onSuccess: () => setSelected(null),
  });

  const isHighlighted = (text: string) =>
    highlights.some((h) => (h.text || "").toLowerCase() === (text || "").toLowerCase());

  const openVocab = async (rawText: string, context?: string) => {
    const text = (rawText || "").trim();
    if (!text || text.length < 2 || text.length > 80) return;
    const existing = highlights.find((h) => (h.text || "").toLowerCase() === text.toLowerCase());
    setNoteDraft(existing?.note || "");
    setSelected({ text, context, loading: true });
    try {
      const explain = unwrap<{ meaning?: string }>(await writingApi.explainPhrase(text, context || ""));
      setSelected((prev) =>
        prev && prev.text === text
          ? { ...prev, loading: false, fields: [{ label: "Meaning", value: explain.meaning || "" }] }
          : prev
      );
    } catch {
      setSelected((prev) =>
        prev && prev.text === text ? { ...prev, loading: false, error: "Failed to load. Tap retry." } : prev
      );
    }
  };

  if (isLoading) return <LoadingView />;
  if (isError || !data) return <ErrorView message="Could not load session" onRetry={() => refetch()} />;

  const messages = data.messages ?? [];
  const canSend = input.trim().length > 0 && !sendMutation.isPending;
  const marks: TextMark[] = highlights.map((h) => ({
    text: h.text,
    color: t.neutral.text,
    tint: t.primaryAlpha(0.16),
  }));

  const renderBubble = ({ item }: { item: WritingMessage }) => {
    const isMe = item.role === "user";
    const fb = messageFeedback(item);
    const hasIssues = isMe && (fb.hasIssues || (fb.mistakes ?? []).length > 0);
    if (isMe) {
      return (
        <View style={{ alignItems: "flex-end" }}>
          <PressableScale onPress={() => setActiveMessage(item)} activeScale={0.99}>
            <GradientSurface style={[styles.bubble, styles.meBubble, { borderRadius: t.radii.lg }]}>
              <MarkedText
                text={item.text || ""}
                marks={marks}
                onWordPress={(w) => openVocab(w, item.text)}
                style={styles.meText}
              />
            </GradientSurface>
          </PressableScale>
          <Text variant="labelSmall" style={{ color: t.neutral.textMuted, marginTop: 4, marginRight: 6 }}>
            {hasIssues ? "Has feedback — tap to view" : "Looks good — tap to view"}
          </Text>
        </View>
      );
    }
    return (
      <View style={{ alignItems: "flex-start" }}>
        <Text
          variant="labelSmall"
          style={{ color: t.neutral.textMuted, fontWeight: "800", letterSpacing: 0.6, marginBottom: 4, marginLeft: 6 }}
        >
          COACH
        </Text>
        <View
          style={[
            styles.bubble,
            styles.coachBubble,
            { backgroundColor: t.neutral.surface, borderColor: t.neutral.border, borderRadius: t.radii.lg },
            t.shadow,
          ]}
        >
          <MarkedText
            text={item.text || ""}
            marks={marks}
            onWordPress={(w) => openVocab(w, item.text)}
            style={{ color: t.neutral.text, fontSize: 15, lineHeight: 22 }}
          />
          <PressableScale
            onPress={() => item.text && speakText(item.text)}
            style={[styles.listenBtn, { backgroundColor: t.primaryAlpha(0.12) }]}
          >
            <MaterialIcons name="volume-up" size={16} color={t.palette.primary} />
          </PressableScale>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: t.neutral.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={[styles.header, { borderBottomColor: t.neutral.border }]}>
        <FeatureTile icon="edit-note" size={40} variant="solid" />
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium" numberOfLines={1} style={{ color: t.neutral.text, fontWeight: "800" }}>
            {data.topic ?? "Writing session"}
          </Text>
          {data.level || data.tone ? (
            <Text variant="bodySmall" style={{ color: t.neutral.textMinor }}>
              {[data.level, data.tone].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
        </View>
        <PressableScale
          onPress={() => restartMutation.mutate()}
          disabled={restartMutation.isPending}
          hitSlop={8}
          style={[styles.iconBtn, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}
        >
          {restartMutation.isPending ? (
            <ActivityIndicator size="small" color={t.neutral.text} />
          ) : (
            <MaterialIcons name="restart-alt" size={20} color={t.neutral.text} />
          )}
        </PressableScale>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item, idx) => item.id ?? String(idx)}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={renderBubble}
        ListHeaderComponent={
          <NotePanel
            targetType="writing_session"
            targetKey={id}
            title={data?.topic}
            targetUrl={`/writing/${id}`}
          />
        }
        ListFooterComponent={
          sendMutation.isPending ? (
            <View style={{ alignItems: "flex-start" }}>
              <View
                style={[
                  styles.bubble,
                  styles.coachBubble,
                  { backgroundColor: t.neutral.surface, borderColor: t.neutral.border, borderRadius: t.radii.lg },
                ]}
              >
                <ActivityIndicator size="small" color={t.neutral.textMinor} />
              </View>
            </View>
          ) : null
        }
      />

      {sendMutation.isError ? (
        <View style={[styles.errorBox, { backgroundColor: t.alpha("#ef4444", 0.12) }]}>
          <MaterialIcons name="error-outline" size={16} color="#ef4444" />
          <Text style={{ color: "#ef4444", flex: 1 }}>Could not send your message.</Text>
          <PressableScale onPress={() => canSend && sendMutation.mutate(input)}>
            <Text style={{ color: t.palette.primary, fontWeight: "700" }}>Retry</Text>
          </PressableScale>
        </View>
      ) : null}

      <View style={[styles.inputBar, { backgroundColor: t.neutral.surface, borderTopColor: t.neutral.border, paddingBottom: insets.bottom + 68 }]}>
        <TextInput
          mode="outlined"
          value={input}
          onChangeText={setInput}
          placeholder="Write your reply…"
          multiline
          style={styles.input}
          outlineStyle={{ borderRadius: t.radii.lg }}
        />
        <PressableScale
          onPress={() => canSend && sendMutation.mutate(input)}
          disabled={!canSend}
          style={[
            styles.sendBtn,
            { backgroundColor: canSend ? t.palette.primary : t.neutral.surface2, borderRadius: t.radii.pill },
          ]}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator size="small" color={t.palette.onPrimary} />
          ) : (
            <MaterialIcons name="send" size={20} color={canSend ? t.palette.onPrimary : t.neutral.textMuted} />
          )}
        </PressableScale>
      </View>

      <FeedbackSheet message={activeMessage} onClose={() => setActiveMessage(null)} t={t} />

      <VocabModal
        selected={selected}
        highlighted={selected ? isHighlighted(selected.text) : false}
        noteDraft={noteDraft}
        onNoteChange={setNoteDraft}
        showHighlightControls
        onClose={() => setSelected(null)}
        onRetry={() => selected && openVocab(selected.text, selected.context)}
        onListen={(text) => speakText(text)}
        onToggleHighlight={(remove) =>
          selected && highlightMutation.mutate({ text: selected.text, note: noteDraft, remove })
        }
        onSaveTerm={() => saveTermMutation.mutate()}
        saving={saveTermMutation.isPending}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 14, paddingBottom: 24 },
  bubble: { padding: 14, maxWidth: "88%" },
  meBubble: { overflow: "hidden" },
  coachBubble: { borderWidth: 1 },
  meText: { color: "#ffffff", fontSize: 15, lineHeight: 22, fontWeight: "600" },
  listenBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, maxHeight: 120, backgroundColor: "transparent" },
  sendBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { maxHeight: "78%", padding: 20, paddingBottom: 28 },
  sheetHead: { flexDirection: "row", alignItems: "center" },
  perfectBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginTop: 12 },
  mistake: { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 8 },
});

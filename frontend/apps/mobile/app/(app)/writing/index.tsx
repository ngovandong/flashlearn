import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Divider, Snackbar, Text, TextInput } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Highlight, Term, WritingSession } from "@flashlearn/core";
import { termApi, writingApi } from "@/api/services";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { MarkedText, type TextMark } from "@/components/MarkedText";
import VocabModal, { type VocabSelection } from "@/components/VocabModal";
import { AppCard } from "@/components/ui/AppCard";
import { GradientButton } from "@/components/ui/GradientButton";
import { NavCard } from "@/components/ui/NavCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useFloatingTabBarHeight } from "@/components/ui/FloatingTabBar";
import { speakText } from "@/utils/audio";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens, type Tokens } from "@/theme/tokens";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const FALLBACK_TOPICS = [
  "A Memorable Holiday",
  "The Benefits of Regular Exercise",
  "The Pros and Cons of Remote Work",
];
const MODE_CARDS = [
  {
    value: "chat" as const,
    icon: "forum",
    title: "Chat mode",
    desc: "Talk with Dragon and get feedback on every message.",
  },
  {
    value: "free" as const,
    icon: "article",
    title: "Free-form mode",
    desc: "Write a full piece and get an IELTS-style band score.",
  },
];
const SUCCESS_GREEN = "#2e7d32";
const WARN_ORANGE = "#ed6c02";
const ERROR_RED = "#d32f2f";

const BAND_LABELS: Record<string, string> = {
  taskResponse: "Task Response",
  coherence: "Coherence",
  lexical: "Lexical",
  grammar: "Grammar",
};

interface Correction {
  type?: string;
  text?: string;
  suggestion?: string;
  issue?: string;
}

export interface WritingFeedback {
  overallBand?: number;
  bands?: Record<string, number>;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  corrections?: Correction[];
  improvedVersion?: string;
}

function stripHtml(html?: string): string {
  return (html || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

const fmtBand = (n?: number) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? `${v}` : v.toFixed(1);
};

export default function WritingScreen() {
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useFloatingTabBarHeight();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"chat" | "free">("chat");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("B1");
  const [draft, setDraft] = useState("");
  const [session, setSession] = useState<WritingSession | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [activeCorrection, setActiveCorrection] = useState<Correction | null>(null);
  const [selected, setSelected] = useState<VocabSelection | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [snack, setSnack] = useState<string | null>(null);

  const startChatMutation = useMutation({
    mutationFn: async () => {
      const res = await writingApi.startChat({ topic, level, tone: "casual" });
      return unwrap<{ id: string }>(res);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.writing.history });
      if (data?.id) router.push(`/writing/${data.id}`);
    },
  });

  const submitDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await writingApi.submitDraft({ topic, draft, level, tone: "casual" });
      return unwrap<WritingSession>(res);
    },
    onSuccess: (s) => {
      setSession(s);
      setHighlights(s.highlights ?? []);
      qc.invalidateQueries({ queryKey: queryKeys.writing.history });
    },
  });

  const highlightMutation = useMutation({
    mutationFn: (payload: { text: string; note?: string; remove?: boolean }) =>
      writingApi.setHighlight(session!.id, payload),
    onSuccess: (res) => setHighlights(unwrap<{ highlights: Highlight[] }>(res).highlights ?? []),
    onError: () => setSnack("Could not update highlight."),
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
    onSuccess: () => {
      setSnack(`"${selected?.text}" saved to your default deck.`);
      setSelected(null);
    },
    onError: () => setSnack("Could not save term."),
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.writing.history,
    queryFn: async () => unwrap<{ sessions: { id: string; topic?: string }[] }>(await writingApi.getHistory()),
  });

  const topicsQuery = useQuery({
    queryKey: ["writing", "topics", level],
    queryFn: async () => unwrap<{ topics?: string[] }>(await writingApi.suggestTopics([], level)),
    staleTime: 5 * 60 * 1000,
  });

  const suggestedTopics = topicsQuery.data?.topics?.length
    ? topicsQuery.data.topics
    : FALLBACK_TOPICS;

  const history = (historyQuery.data?.sessions ?? []).slice(0, 5);
  const feedback = (session?.feedback as WritingFeedback | undefined) ?? null;

  const canStart = topic.trim().length > 0;
  const primaryBusy = startChatMutation.isPending || submitDraftMutation.isPending;
  const onPrimary = () => {
    if (!canStart) return;
    if (mode === "chat") startChatMutation.mutate();
    else if (draft.trim()) submitDraftMutation.mutate();
  };

  const isHighlighted = (text: string) =>
    highlights.some((h) => (h.text || "").toLowerCase() === (text || "").toLowerCase());

  const openVocab = async (rawText: string, context?: string) => {
    const text = (rawText || "").trim();
    if (!text || text.length < 2 || text.length > 80) return;
    const existing = highlights.find((h) => (h.text || "").toLowerCase() === text.toLowerCase());
    setNoteDraft(existing?.note || "");
    setSelected({ text, context, loading: true });
    try {
      const [enrich, explain] = await Promise.all([
        unwrap<Partial<Term>>(await termApi.aiEnrich(text, "")),
        unwrap<{ meaning?: string; examples?: string[] }>(await writingApi.explainPhrase(text, context || "")),
      ]);
      setSelected((prev) =>
        prev && prev.text === text
          ? {
              ...prev,
              loading: false,
              fields: [
                { label: "Meaning", value: explain.meaning || enrich.definition || "" },
                { label: "Pronunciation", value: enrich.pronunciation || "" },
                { label: "Word type", value: enrich.word_type || "" },
                { label: "Example", value: stripHtml(explain.examples?.[0] || enrich.examples?.[0]) },
              ],
            }
          : prev
      );
    } catch {
      setSelected((prev) =>
        prev && prev.text === text ? { ...prev, loading: false, error: "Failed to load. Tap retry." } : prev
      );
    }
  };

  const draftMarks: TextMark[] = [
    ...(feedback?.corrections ?? []).map((c) => ({
      text: c.text || "",
      color: t.mode === "dark" ? "#f87171" : ERROR_RED,
      tint: t.alpha(ERROR_RED, 0.14),
      onPress: () => setActiveCorrection(c),
    })),
    ...highlights.map((h) => ({ text: h.text, color: t.neutral.text, tint: t.primaryAlpha(0.16) })),
  ];

  return (
    <ScrollView
      style={{ backgroundColor: t.neutral.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: tabBarHeight }]}
      showsVerticalScrollIndicator={false}
    >
      <FadeSlideIn>
        <Text variant="labelLarge" style={{ color: t.palette.primary, fontWeight: "700" }}>
          Writing coach
        </Text>
        <Text variant="headlineMedium" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 2 }}>
          Improve your writing
        </Text>
      </FadeSlideIn>

      <FadeSlideIn delay={60}>
        <AppCard padding={16}>
          <Text variant="labelSmall" style={[styles.eyebrow, { color: t.palette.primary }]}>
            WHAT WOULD YOU LIKE TO PRACTICE?
          </Text>
          <Text variant="titleLarge" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 2 }}>
            Choose a topic
          </Text>

          <TextInput
            mode="outlined"
            value={topic}
            onChangeText={setTopic}
            placeholder="Type your own topic, or pick one below…"
            style={{ marginTop: 14 }}
          />

          <View style={styles.chips}>
            {suggestedTopics.map((tp) => {
              const active = topic === tp;
              return (
                <PressableScale
                  key={tp}
                  onPress={() => setTopic(tp)}
                  style={[
                    styles.chip,
                    {
                      borderRadius: t.radii.pill,
                      borderColor: active ? t.palette.primary : t.neutral.border,
                      backgroundColor: active ? t.primaryAlpha(0.1) : t.neutral.surface,
                    },
                  ]}
                >
                  <MaterialIcons name="auto-awesome" size={13} color={t.palette.primary} />
                  <Text
                    style={{ color: active ? t.palette.primary : t.neutral.textMinor, fontWeight: active ? "700" : "600" }}
                    numberOfLines={1}
                  >
                    {tp}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          <Text style={[styles.groupLabel, { color: t.neutral.textMuted }]}>YOUR LEVEL (CEFR)</Text>
          <View style={styles.levelRow}>
            {LEVELS.map((l) => {
              const active = level === l;
              return (
                <PressableScale
                  key={l}
                  onPress={() => setLevel(l)}
                  style={[
                    styles.levelPill,
                    { backgroundColor: active ? t.palette.primary : t.neutral.surface2, borderRadius: t.radii.pill },
                  ]}
                >
                  <Text style={{ color: active ? t.palette.onPrimary : t.neutral.textMinor, fontWeight: active ? "800" : "600" }}>
                    {l}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          <View style={styles.modeGrid}>
            {MODE_CARDS.map((m) => {
              const active = mode === m.value;
              return (
                <PressableScale
                  key={m.value}
                  onPress={() => setMode(m.value)}
                  style={[
                    styles.modeCard,
                    {
                      borderRadius: t.radii.md,
                      borderColor: active ? t.palette.primary : t.neutral.border,
                      backgroundColor: active ? t.primaryAlpha(0.07) : t.neutral.surface,
                    },
                  ]}
                >
                  <MaterialIcons name={m.icon as any} size={22} color={t.palette.primary} />
                  <Text variant="titleSmall" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 6 }}>
                    {m.title}
                  </Text>
                  <Text variant="bodySmall" style={{ color: t.neutral.textMinor, marginTop: 2 }}>
                    {m.desc}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          {mode === "free" ? (
            <TextInput
              label="Your draft"
              mode="outlined"
              value={draft}
              onChangeText={setDraft}
              multiline
              numberOfLines={6}
              style={{ marginTop: 14 }}
            />
          ) : null}

          <View style={[styles.tip, { backgroundColor: t.primaryAlpha(0.08), borderRadius: t.radii.md }]}>
            <MaterialIcons name="highlight-alt" size={16} color={t.palette.primary} />
            <Text variant="bodySmall" style={{ color: t.neutral.textMinor, flex: 1 }}>
              Tip: tap any word later to see its meaning and save it to a deck.
            </Text>
          </View>

          <GradientButton
            label={mode === "chat" ? "Start chatting" : "Get feedback"}
            onPress={onPrimary}
            loading={primaryBusy}
            disabled={!canStart || (mode === "free" && !draft.trim())}
            style={{ marginTop: 14 }}
          />
          {submitDraftMutation.isError ? (
            <Text variant="bodySmall" style={{ color: ERROR_RED, marginTop: 8, textAlign: "center" }}>
              Could not assess your writing. Please try again.
            </Text>
          ) : null}
          {startChatMutation.isError ? (
            <Text variant="bodySmall" style={{ color: ERROR_RED, marginTop: 8, textAlign: "center" }}>
              Could not start the chat. Please try again.
            </Text>
          ) : null}
        </AppCard>
      </FadeSlideIn>

      {mode === "free" && feedback && session ? (
        <FadeSlideIn delay={80}>
          <FeedbackReport
            feedback={feedback}
            draft={session.draft || draft}
            draftMarks={draftMarks}
            activeCorrection={activeCorrection}
            onWordPress={(w) => openVocab(w)}
            t={t}
          />
        </FadeSlideIn>
      ) : null}

      {history.length > 0 ? (
        <FadeSlideIn delay={120} style={styles.section}>
          <SectionHeader title="Recent sessions" />
          <View style={{ gap: 12 }}>
            {history.map((s) => (
              <NavCard
                key={s.id}
                icon="edit-note"
                title={s.topic ?? "Writing session"}
                onPress={() => router.push(`/writing/${s.id}`)}
              />
            ))}
          </View>
        </FadeSlideIn>
      ) : null}

      <VocabModal
        selected={selected}
        highlighted={selected ? isHighlighted(selected.text) : false}
        noteDraft={noteDraft}
        onNoteChange={setNoteDraft}
        showHighlightControls={!!session?.id}
        onClose={() => setSelected(null)}
        onRetry={() => selected && openVocab(selected.text, selected.context)}
        onListen={(text) => speakText(text)}
        onToggleHighlight={(remove) =>
          selected && highlightMutation.mutate({ text: selected.text, note: noteDraft, remove })
        }
        onSaveTerm={() => saveTermMutation.mutate()}
        saving={saveTermMutation.isPending}
      />

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3000}>
        {snack}
      </Snackbar>
    </ScrollView>
  );
}

export function FeedbackReport({
  feedback,
  draft,
  draftMarks,
  activeCorrection,
  onWordPress,
  t,
}: {
  feedback: WritingFeedback;
  draft: string;
  draftMarks: TextMark[];
  activeCorrection: Correction | null;
  onWordPress: (word: string) => void;
  t: Tokens;
}) {
  const bands = feedback.bands ?? {};
  const strengths = feedback.strengths ?? [];
  const improvements = feedback.improvements ?? [];
  const corrections = feedback.corrections ?? [];

  return (
    <AppCard padding={16}>
      {draft ? (
        <>
          <Text variant="labelLarge" style={{ color: t.neutral.text }}>
            Your draft
          </Text>
          <MarkedText
            text={draft}
            marks={draftMarks}
            onWordPress={onWordPress}
            style={{ color: t.neutral.textMinor, marginTop: 6, lineHeight: 22 }}
          />
          {activeCorrection ? (
            <View style={[styles.correctionBox, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.md }]}>
              <Text>
                <Text style={{ color: ERROR_RED, textDecorationLine: "line-through" }}>
                  {activeCorrection.text}
                </Text>
                <Text style={{ color: t.neutral.textMinor }}>{"  →  "}</Text>
                <Text style={{ color: SUCCESS_GREEN, fontWeight: "700" }}>{activeCorrection.suggestion}</Text>
              </Text>
              {activeCorrection.issue ? (
                <Text style={{ color: t.neutral.textMinor, marginTop: 4 }}>{activeCorrection.issue}</Text>
              ) : null}
            </View>
          ) : null}
          <Divider style={styles.reportDivider} />
        </>
      ) : null}

      <View>
        <Text variant="labelMedium" style={{ color: t.neutral.textMinor }}>
          Overall band
        </Text>
        <Text variant="displaySmall" style={{ color: t.palette.primary, fontWeight: "800" }}>
          {fmtBand(feedback.overallBand)}
          <Text variant="titleMedium" style={{ color: t.neutral.textMinor }}>
            {" "}/ 9.0
          </Text>
        </Text>
      </View>

      <View style={styles.bandGrid}>
        {Object.keys(BAND_LABELS).map((key) => (
          <View key={key} style={[styles.bandCard, { backgroundColor: t.neutral.surface2 }]}>
            <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800" }}>
              {fmtBand(bands[key])}
            </Text>
            <Text variant="labelSmall" style={{ color: t.neutral.textMinor, textAlign: "center" }}>
              {BAND_LABELS[key]}
            </Text>
          </View>
        ))}
      </View>

      {feedback.summary ? (
        <>
          <Divider style={styles.reportDivider} />
          <Text variant="labelLarge" style={{ color: t.neutral.text }}>
            Examiner summary
          </Text>
          <MarkedText
            text={feedback.summary}
            onWordPress={onWordPress}
            style={{ color: t.neutral.textMinor, marginTop: 4 }}
          />
        </>
      ) : null}

      {strengths.length > 0 ? (
        <>
          <Text variant="labelLarge" style={{ color: SUCCESS_GREEN, marginTop: 12 }}>
            Strengths
          </Text>
          {strengths.map((s, i) => (
            <Text key={i} variant="bodyMedium" style={{ color: t.neutral.textMinor, marginTop: 2 }}>
              • {s}
            </Text>
          ))}
        </>
      ) : null}

      {improvements.length > 0 ? (
        <>
          <Text variant="labelLarge" style={{ color: WARN_ORANGE, marginTop: 12 }}>
            To improve
          </Text>
          {improvements.map((s, i) => (
            <Text key={i} variant="bodyMedium" style={{ color: t.neutral.textMinor, marginTop: 2 }}>
              • {s}
            </Text>
          ))}
        </>
      ) : null}

      {corrections.length > 0 ? (
        <>
          <Divider style={styles.reportDivider} />
          <Text variant="labelLarge" style={{ color: t.neutral.text }}>
            Corrections
          </Text>
          {corrections.map((c, i) => (
            <View key={i} style={styles.correction}>
              <Text variant="bodyMedium">
                <Text style={{ color: t.mode === "dark" ? "#f87171" : ERROR_RED, textDecorationLine: "line-through" }}>
                  {c.text}
                </Text>
                <Text style={{ color: t.neutral.textMinor }}>{"  →  "}</Text>
                <Text style={{ color: SUCCESS_GREEN, fontWeight: "600" }}>{c.suggestion}</Text>
              </Text>
              {c.issue ? (
                <Text variant="bodySmall" style={{ color: t.neutral.textMinor, marginTop: 2 }}>
                  {c.issue}
                </Text>
              ) : null}
            </View>
          ))}
        </>
      ) : null}

      {feedback.improvedVersion ? (
        <>
          <Divider style={styles.reportDivider} />
          <Text variant="labelLarge" style={{ color: t.neutral.text }}>
            Model rewrite
          </Text>
          <MarkedText
            text={feedback.improvedVersion}
            onWordPress={onWordPress}
            style={{ color: t.neutral.textMinor, marginTop: 4, fontStyle: "italic" }}
          />
        </>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  section: { gap: 12 },
  eyebrow: { fontWeight: "800", letterSpacing: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    maxWidth: "100%",
  },
  groupLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  levelRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  levelPill: { paddingHorizontal: 16, paddingVertical: 9, minWidth: 52, alignItems: "center" },
  modeGrid: { flexDirection: "row", gap: 10, marginTop: 16 },
  modeCard: { flex: 1, padding: 12, borderWidth: 1.5 },
  tip: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginTop: 16 },
  bandGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  bandCard: { flexGrow: 1, flexBasis: "22%", minWidth: 70, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  reportDivider: { marginVertical: 12 },
  correction: { marginTop: 8 },
  correctionBox: { padding: 12, marginTop: 10 },
});

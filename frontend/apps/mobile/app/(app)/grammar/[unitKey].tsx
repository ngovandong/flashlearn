import React, { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Snackbar, Text, TextInput } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { GrammarExercise, Highlight, Term } from "@flashlearn/core";
import { grammarApi, termApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { NotePanel } from "@/components/note/NotePanel";
import { AppCard } from "@/components/ui/AppCard";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { GradientButton } from "@/components/ui/GradientButton";
import { useFloatingTabBarHeight } from "@/components/ui/FloatingTabBar";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { speakText } from "@/utils/audio";
import { useTokens, type Tokens } from "@/theme/tokens";

const GREEN = "#10b981";
const RED = "#ef4444";

interface ExplanationBlock {
  label?: string;
  html?: string;
  examples?: string[];
}

interface ExerciseItem {
  text?: string;
  blanks?: number;
  options?: string[];
  tokens?: string[];
}

interface ItemResult {
  blanks?: boolean[];
  correct?: boolean;
  answers?: string[];
  given?: string[];
}

interface GradeResult {
  score?: number;
  completed?: boolean;
  results?: ItemResult[];
}

interface UnitDetail {
  title?: string;
  explanation?: ExplanationBlock[];
  exercises: GrammarExercise[];
  progress?: { highlights?: Highlight[] };
}

const PASS_THRESHOLD = 80;

// The explanation blocks carry light HTML (`<b>` etc.). React Native has no HTML
// renderer, so flatten to plain text for display and for the highlight helper.
function stripHtml(html?: string): string {
  return (html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

interface VocabSelection {
  text: string;
  loading?: boolean;
  error?: string;
  fields?: Partial<Term>;
}

const isWordChar = (ch: string) => /[a-z0-9']/i.test(ch || "");

interface Mark {
  start: number;
  end: number;
  payload: Highlight;
}

// Port of the web `grammarMarks.buildMarks` helper: find non-overlapping,
// whole-word occurrences of each saved highlight inside a plain-text string.
function buildMarks(text: string, highlights: Highlight[]): Mark[] {
  const lower = text.toLowerCase();
  const marks: Mark[] = [];
  (highlights || []).forEach((h) => {
    const needle = (h.text || "").toLowerCase().trim();
    if (!needle) return;
    let from = 0;
    for (;;) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      const end = idx + needle.length;
      if (!isWordChar(lower[idx - 1]) && !isWordChar(lower[end])) {
        marks.push({ start: idx, end, payload: h });
      }
      from = end;
    }
  });
  marks.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const out: Mark[] = [];
  let lastEnd = 0;
  for (const m of marks) {
    if (m.start >= lastEnd) {
      out.push(m);
      lastEnd = m.end;
    }
  }
  return out;
}

// Renders a plain-text string so every word is tappable (opens the vocab
// lookup for that word) and any saved highlight phrase is tinted, mirroring
// the web `renderWithHighlights` + "select text" behaviour without relying on
// a text-selection gesture, which mobile doesn't have.
function TappableText({
  text,
  highlights,
  onWordPress,
  style,
  t,
}: {
  text: string;
  highlights: Highlight[];
  onWordPress: (word: string) => void;
  style?: object;
  t: Tokens;
}) {
  if (!text) return null;
  const marks = buildMarks(text, highlights);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  const pushPlain = (segment: string) => {
    const tokens = segment.split(/(\s+)/);
    tokens.forEach((tok) => {
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

  marks.forEach((m) => {
    if (m.start > cursor) pushPlain(text.slice(cursor, m.start));
    const segment = text.slice(m.start, m.end);
    key += 1;
    nodes.push(
      <Text
        key={key}
        onPress={() => onWordPress(segment)}
        suppressHighlighting
        style={{ backgroundColor: t.feature("spellcheck").tint, color: t.feature("spellcheck").fg, fontWeight: "700" }}
      >
        {segment}
      </Text>
    );
    cursor = m.end;
  });
  if (cursor < text.length) pushPlain(text.slice(cursor));

  return <Text style={style}>{nodes}</Text>;
}

/** Bottom-sheet-style modal for the word/phrase tapped in grammar content.
 * Mirrors the web `VocabPopup`: AI meaning/pronunciation, listen, highlight
 * toggle, and save-to-default-deck. */
function VocabModal({
  selected,
  isHighlighted,
  noteDraft,
  onNoteChange,
  onClose,
  onRetry,
  onToggleHighlight,
  onSaveTerm,
  saving,
  t,
}: {
  selected: VocabSelection | null;
  isHighlighted: (text: string) => boolean;
  noteDraft: string;
  onNoteChange: (v: string) => void;
  onClose: () => void;
  onRetry: () => void;
  onToggleHighlight: (remove?: boolean) => void;
  onSaveTerm: () => void;
  saving: boolean;
  t: Tokens;
}) {
  if (!selected) return null;
  const highlighted = isHighlighted(selected.text);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: t.neutral.surface, borderRadius: t.radii.xl }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHead}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.palette.primary, fontWeight: "700", fontSize: 12 }}>VOCABULARY</Text>
              <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 2 }}>
                "{selected.text}"
              </Text>
            </View>
            <PressableScale onPress={onClose} hitSlop={8}>
              <MaterialIcons name="close" size={22} color={t.neutral.textMuted} />
            </PressableScale>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {selected.loading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color={t.palette.primary} />
                <Text style={{ color: t.neutral.textMuted, marginTop: 8 }}>Looking it up…</Text>
              </View>
            ) : selected.error ? (
              <View style={styles.modalLoading}>
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
                <Text style={{ color: t.neutral.textMuted, fontWeight: "700", fontSize: 12 }}>MEANING</Text>
                <Text style={{ color: t.neutral.text, marginTop: 2 }}>{selected.fields?.definition || "—"}</Text>

                <View style={styles.modalGrid}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.neutral.textMuted, fontWeight: "700", fontSize: 12 }}>PRONUNCIATION</Text>
                    <Text style={{ color: t.neutral.text, marginTop: 2 }}>{selected.fields?.pronunciation || "/--/"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.neutral.textMuted, fontWeight: "700", fontSize: 12 }}>WORD TYPE</Text>
                    <Text style={{ color: t.neutral.text, marginTop: 2 }}>{selected.fields?.word_type || "—"}</Text>
                  </View>
                </View>

                {(selected.fields?.examples ?? []).length > 0 ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ color: t.neutral.textMuted, fontWeight: "700", fontSize: 12 }}>EXAMPLE</Text>
                    <Text style={{ color: t.neutral.text, marginTop: 2 }}>{stripHtml(selected.fields?.examples?.[0])}</Text>
                  </View>
                ) : null}

                <Text style={{ color: t.neutral.textMuted, fontWeight: "700", fontSize: 12, marginTop: 14 }}>
                  NOTE (OPTIONAL)
                </Text>
                <TextInput
                  mode="outlined"
                  dense
                  value={noteDraft}
                  onChangeText={onNoteChange}
                  placeholder="Add a quick note for this highlight…"
                  outlineStyle={{ borderRadius: t.radii.md }}
                  style={[styles.input, { marginTop: 6 }]}
                />

                <View style={styles.modalActionsRow}>
                  <PressableScale
                    onPress={() => onToggleHighlight(false)}
                    style={[
                      styles.pillBtn,
                      {
                        backgroundColor: highlighted ? t.palette.primary : t.neutral.surface2,
                        borderRadius: t.radii.pill,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name="border-color"
                      size={16}
                      color={highlighted ? t.palette.onPrimary : t.neutral.text}
                    />
                    <Text style={{ color: highlighted ? t.palette.onPrimary : t.neutral.text, fontWeight: "700" }}>
                      {highlighted ? "Update highlight" : "Highlight here"}
                    </Text>
                  </PressableScale>
                  {highlighted ? (
                    <PressableScale
                      onPress={() => onToggleHighlight(true)}
                      style={[styles.pillBtnGhost, { borderColor: t.neutral.border, borderRadius: t.radii.pill }]}
                    >
                      <MaterialIcons name="close" size={16} color={t.neutral.text} />
                      <Text style={{ color: t.neutral.text, fontWeight: "700" }}>Remove</Text>
                    </PressableScale>
                  ) : null}
                </View>

                <View style={styles.modalActionsRow}>
                  <PressableScale
                    onPress={() => speakText(selected.text)}
                    style={[styles.pillBtnGhost, { borderColor: t.neutral.border, borderRadius: t.radii.pill }]}
                  >
                    <MaterialIcons name="volume-up" size={16} color={t.neutral.text} />
                    <Text style={{ color: t.neutral.text, fontWeight: "700" }}>Listen</Text>
                  </PressableScale>
                  <PressableScale
                    onPress={onSaveTerm}
                    disabled={saving}
                    style={[styles.pillBtn, { backgroundColor: t.palette.primary, borderRadius: t.radii.pill }]}
                  >
                    <MaterialIcons name="add" size={16} color={t.palette.onPrimary} />
                    <Text style={{ color: t.palette.onPrimary, fontWeight: "700" }}>
                      {saving ? "Saving…" : "Save to deck"}
                    </Text>
                  </PressableScale>
                </View>
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Tappable option / token chip with result-aware coloring. */
function TapChip({
  label,
  onPress,
  disabled,
  tone = "default",
  t,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: "default" | "selected" | "correct" | "wrong";
  t: Tokens;
}) {
  const map = {
    default: { bg: t.neutral.surface2, fg: t.neutral.text },
    selected: { bg: t.palette.primary, fg: t.palette.onPrimary },
    correct: { bg: t.alpha(GREEN, 0.16), fg: GREEN },
    wrong: { bg: t.alpha(RED, 0.16), fg: RED },
  }[tone];
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, { backgroundColor: map.bg, borderRadius: t.radii.pill }]}
    >
      <Text style={{ color: map.fg, fontWeight: "700" }}>{label}</Text>
    </PressableScale>
  );
}

export default function GrammarUnitScreen() {
  const { unitKey } = useLocalSearchParams<{ unitKey: string }>();
  const t = useTokens();
  const tabBarHeight = useFloatingTabBarHeight();
  const queryClient = useQueryClient();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selected, setSelected] = useState<VocabSelection | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [clearing, setClearing] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  // Bumped after a successful clear to force-remount every ExerciseCard —
  // they keep local given/order/result state that a query invalidation alone
  // won't reset (mirrors web's `resetNonce`).
  const [resetNonce, setResetNonce] = useState(0);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.grammar.unit(unitKey!),
    queryFn: async () => unwrap<UnitDetail>(await grammarApi.getUnit(unitKey!)),
    enabled: !!unitKey,
  });

  React.useEffect(() => {
    if (data?.progress?.highlights) setHighlights(data.progress.highlights);
  }, [data?.progress?.highlights]);

  const highlightMutation = useMutation({
    mutationFn: async (payload: { text: string; note?: string; remove?: boolean }) => {
      const res = await grammarApi.setHighlight(unitKey!, payload);
      return unwrap<{ highlights: Highlight[] }>(res);
    },
    onSuccess: (res) => setHighlights(res.highlights ?? []),
    onError: () => setSnack("Could not update highlight."),
  });

  const saveTermMutation = useMutation({
    mutationFn: async () => {
      if (!selected?.fields) return;
      const payload: Term = {
        name: selected.text,
        meaning: selected.fields.definition || "",
        ...selected.fields,
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

  const isHighlighted = (text: string) =>
    highlights.some((h) => (h.text || "").toLowerCase() === (text || "").toLowerCase());

  const openVocab = async (rawText: string) => {
    const text = (rawText || "").trim();
    if (!text || text.length < 2 || text.length > 80) return;
    setNoteDraft("");
    setSelected({ text, loading: true });
    try {
      const fields = unwrap<Partial<Term>>(await termApi.aiEnrich(text, ""));
      setSelected((prev) => (prev && prev.text === text ? { ...prev, loading: false, fields } : prev));
    } catch {
      setSelected((prev) =>
        prev && prev.text === text ? { ...prev, loading: false, error: "Couldn't load. Tap retry." } : prev
      );
    }
  };

  const toggleHighlight = (remove = false) => {
    if (!selected?.text) return;
    highlightMutation.mutate({ text: selected.text, note: noteDraft, remove });
    if (remove) setSelected(null);
  };

  const handleClearResults = () => {
    if (!unitKey || clearing) return;
    Alert.alert("Clear results?", "This resets progress and answers for every exercise in this unit.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          setClearing(true);
          try {
            unwrap(await grammarApi.clearUnitProgress(unitKey));
            await queryClient.invalidateQueries({ queryKey: ["grammar"] });
            setResetNonce((n) => n + 1);
            setSnack("Lesson results cleared.");
          } catch {
            setSnack("Could not clear results.");
          } finally {
            setClearing(false);
          }
        },
      },
    ]);
  };

  if (isLoading) return <LoadingView />;
  if (isError) return <ErrorView message="Could not load unit" onRetry={() => refetch()} />;

  const exercises = data?.exercises ?? [];
  const blocks = data?.explanation ?? [];
  const hasResults = exercises.some(
    (e: any) =>
      e.progress?.status === "completed" ||
      (e.progress?.best_score || 0) > 0 ||
      (e.progress?.last_result?.results || []).length > 0
  );

  return (
    <ScrollView style={{ backgroundColor: t.neutral.bg }} contentContainerStyle={[styles.pad, { paddingBottom: tabBarHeight }]} showsVerticalScrollIndicator={false}>
      <FadeSlideIn>
        <View style={styles.brandRow}>
          <FeatureTile icon="spellcheck" size={46} variant="solid" />
          <Text variant="headlineSmall" style={{ color: t.neutral.text, fontWeight: "800", flex: 1 }}>
            {data?.title}
          </Text>
        </View>
      </FadeSlideIn>

      {blocks.length > 0 ? (
        <FadeSlideIn delay={50} style={{ marginTop: 16 }}>
          <AppCard>
            <View style={styles.explainHead}>
              <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800" }}>
                Grammar
              </Text>
              <Text style={{ color: t.neutral.textMuted, fontSize: 12, flex: 1, textAlign: "right" }}>
                Tap any word to look it up
              </Text>
            </View>
            {blocks.map((block, i) => {
              const body = stripHtml(block.html);
              return (
                <View key={i} style={{ marginTop: i === 0 ? 10 : 14 }}>
                  {block.label ? (
                    <Text variant="labelLarge" style={{ color: t.palette.primary, fontWeight: "800" }}>
                      {block.label}
                    </Text>
                  ) : null}
                  {body ? (
                    <TappableText
                      text={body}
                      highlights={highlights}
                      onWordPress={openVocab}
                      style={{ color: t.neutral.textMinor, marginTop: 2, lineHeight: 22, fontSize: 15 }}
                      t={t}
                    />
                  ) : null}
                  {(block.examples ?? []).map((ex, k) => (
                    <View key={k} style={{ flexDirection: "row", marginTop: 6, marginLeft: 4 }}>
                      <Text style={{ color: t.neutral.text }}>• </Text>
                      <TappableText
                        text={ex}
                        highlights={highlights}
                        onWordPress={openVocab}
                        style={{ color: t.neutral.text, lineHeight: 21, flex: 1 }}
                        t={t}
                      />
                    </View>
                  ))}
                </View>
              );
            })}
          </AppCard>
        </FadeSlideIn>
      ) : null}

      {highlights.length > 0 ? (
        <View style={styles.chips}>
          {highlights.map((h) => (
            <View
              key={h.text}
              style={[styles.wordChip, { backgroundColor: t.feature("spellcheck").tint, borderRadius: t.radii.pill }]}
            >
              <PressableScale onPress={() => openVocab(h.text)}>
                <Text style={{ color: t.feature("spellcheck").fg, fontWeight: "700", fontSize: 13 }}>{h.text}</Text>
              </PressableScale>
              <PressableScale onPress={() => highlightMutation.mutate({ text: h.text, remove: true })} hitSlop={6}>
                <MaterialIcons name="close" size={15} color={t.feature("spellcheck").fg} />
              </PressableScale>
            </View>
          ))}
        </View>
      ) : null}

      <NotePanel
        targetType="grammar_unit"
        targetKey={unitKey}
        title={data?.title}
        targetUrl={`/grammar/${unitKey}`}
      />

      {exercises.length > 0 ? (
        <View style={styles.practiceHead}>
          <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800" }}>
            Practice
          </Text>
          {hasResults ? (
            <PressableScale
              onPress={handleClearResults}
              disabled={clearing}
              style={[styles.pillBtnGhost, { borderColor: t.neutral.border, borderRadius: t.radii.pill }]}
            >
              <MaterialIcons name="refresh" size={16} color={t.neutral.textMinor} />
              <Text style={{ color: t.neutral.textMinor, fontWeight: "700" }}>
                {clearing ? "Clearing…" : "Clear results"}
              </Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}

      {exercises.map((exercise, i) => (
        <FadeSlideIn key={`${exercise.key}:${resetNonce}`} delay={40 + i * 30} style={{ marginTop: 12 }}>
          <ExerciseCard exercise={exercise} unitTitle={data?.title ?? ""} />
        </FadeSlideIn>
      ))}

      <VocabModal
        selected={selected}
        isHighlighted={isHighlighted}
        noteDraft={noteDraft}
        onNoteChange={setNoteDraft}
        onClose={() => setSelected(null)}
        onRetry={() => selected && openVocab(selected.text)}
        onToggleHighlight={toggleHighlight}
        onSaveTerm={() => saveTermMutation.mutate()}
        saving={saveTermMutation.isPending}
        t={t}
      />

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3000}>
        {snack}
      </Snackbar>
    </ScrollView>
  );
}

interface ReorderState {
  bank: string[];
  line: string[];
}

// One interactive, server-graded exercise. Mirrors the web `Exercise` component:
// answers are graded on the server, which returns the correct answers so we can
// reveal them per blank after a submission.
function ExerciseCard({ exercise, unitTitle }: { exercise: GrammarExercise; unitTitle: string }) {
  const t = useTokens();
  const kind = exercise.kind ?? "fill_blank";
  const items = (exercise.items ?? []) as ExerciseItem[];
  const exerciseOptions = exercise.options ?? [];
  const progress = exercise.progress as { status?: string; last_result?: GradeResult } | undefined;
  const savedResults = progress?.last_result?.results;

  const initGiven = () =>
    items.map((item, i) => {
      const prev = Array.isArray(savedResults) ? savedResults[i]?.given : undefined;
      if (kind === "fill_blank") {
        const n = item.blanks || 1;
        return Array.from({ length: n }, (_, k) => (Array.isArray(prev) ? prev[k] ?? "" : ""));
      }
      return [Array.isArray(prev) ? prev[0] ?? "" : ""];
    });
  const initOrder = (): ReorderState[] =>
    items.map((item) => ({ bank: [...(item.tokens ?? [])], line: [] }));
  // Replay the last saved attempt so a revisited unit shows the prior score
  // and per-item right/wrong state instead of a blank exercise (matches web).
  const initResult = (): GradeResult | null => {
    if (!Array.isArray(savedResults) || !savedResults.length) return null;
    const score = progress?.last_result?.score || 0;
    return {
      score,
      results: savedResults,
      completed: progress?.status === "completed" || score >= PASS_THRESHOLD,
    };
  };

  const [given, setGiven] = useState<string[][]>(initGiven);
  const [order, setOrder] = useState<ReorderState[]>(initOrder);
  const [result, setResult] = useState<GradeResult | null>(initResult);
  const [explain, setExplain] = useState<Record<number, { answer?: string; examples?: string[]; tip?: string } | { error: string } | { loading: true }>>({});

  const submitMutation = useMutation({
    mutationFn: async () => {
      const submissions = items.map((_, i) => {
        if (kind === "reorder") return [order[i]?.line.join(" ") ?? ""];
        return given[i] ?? [""];
      });
      return unwrap<GradeResult>(await grammarApi.submitExercise(exercise.key, submissions));
    },
    onSuccess: (res) => setResult(res),
  });

  const explainMutation = useMutation({
    mutationFn: async (payload: Record<string, string>) =>
      unwrap<{ answer?: string; examples?: string[]; tip?: string }>(await grammarApi.explain(payload)),
  });

  const setBlank = (itemIndex: number, blankIndex: number, value: string) => {
    setGiven((prev) => {
      const next = prev.map((row) => [...row]);
      next[itemIndex][blankIndex] = value;
      return next;
    });
  };

  const moveToLine = (itemIndex: number, tokenIndex: number) => {
    setOrder((prev) => {
      const next = prev.map((o) => ({ bank: [...o.bank], line: [...o.line] }));
      const [tok] = next[itemIndex].bank.splice(tokenIndex, 1);
      next[itemIndex].line.push(tok);
      return next;
    });
  };

  const moveToBank = (itemIndex: number, tokenIndex: number) => {
    setOrder((prev) => {
      const next = prev.map((o) => ({ bank: [...o.bank], line: [...o.line] }));
      const [tok] = next[itemIndex].line.splice(tokenIndex, 1);
      next[itemIndex].bank.push(tok);
      return next;
    });
  };

  const reset = () => {
    setGiven(initGiven());
    setOrder(initOrder());
    setResult(null);
    setExplain({});
  };

  const askExplain = async (itemIndex: number) => {
    const item = items[itemIndex];
    const r = result?.results?.[itemIndex];
    const sentence = kind === "reorder" ? (r?.answers ?? []).join(" ") : item.text ?? "";
    setExplain((prev) => ({ ...prev, [itemIndex]: { loading: true } }));
    try {
      const data = await explainMutation.mutateAsync({
        unit_title: unitTitle,
        sentence,
        given: (r?.given ?? []).join(" "),
        correct: (r?.answers ?? []).join(" "),
      });
      setExplain((prev) => ({ ...prev, [itemIndex]: data }));
    } catch {
      setExplain((prev) => ({ ...prev, [itemIndex]: { error: "Dragon couldn't explain right now." } }));
    }
  };

  const itemResult = (i: number) => (result ? result.results?.[i] : undefined);

  return (
    <AppCard>
      {exercise.prompt ? (
        <Text variant="titleSmall" style={{ color: t.neutral.text, fontWeight: "700" }}>
          {exercise.prompt}
        </Text>
      ) : null}

      {items.map((item, i) => {
        const r = itemResult(i);
        return (
          <View key={i} style={{ marginTop: 14 }}>
            <ExerciseItemView
              kind={kind}
              item={item}
              exerciseOptions={exerciseOptions}
              given={given[i] ?? [""]}
              order={order[i]}
              result={r}
              onBlank={(bi, v) => setBlank(i, bi, v)}
              onSelect={(v) => setBlank(i, 0, v)}
              onMoveToLine={(ti) => moveToLine(i, ti)}
              onMoveToBank={(ti) => moveToBank(i, ti)}
            />
            {r && !r.correct ? (
              <>
                {(r.answers ?? []).length > 0 ? (
                  <Text style={{ color: RED, marginTop: 6, fontWeight: "600" }}>
                    Answer: {(r.answers ?? []).join(", ")}
                  </Text>
                ) : null}
                <PressableScale onPress={() => askExplain(i)} hitSlop={8} style={{ alignSelf: "flex-start", marginTop: 6 }}>
                  <Text style={{ color: t.palette.primary, fontWeight: "700" }}>
                    {"loading" in (explain[i] ?? {}) ? "Asking…" : "Why?"}
                  </Text>
                </PressableScale>
                {explain[i] && "answer" in explain[i] ? (
                  <View style={[styles.explain, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.md }]}>
                    {explain[i].answer ? (
                      <Text style={{ color: t.neutral.text }}>{explain[i].answer}</Text>
                    ) : null}
                    {(explain[i].examples ?? []).map((ex, k) => (
                      <Text key={k} style={{ color: t.neutral.textMinor, marginTop: 4 }}>
                        • {ex}
                      </Text>
                    ))}
                    {explain[i].tip ? (
                      <Text style={{ color: t.neutral.textMinor, marginTop: 8 }}>💡 {explain[i].tip}</Text>
                    ) : null}
                  </View>
                ) : null}
                {explain[i] && "error" in explain[i] ? (
                  <Text style={{ color: RED, marginTop: 4 }}>{explain[i].error}</Text>
                ) : null}
              </>
            ) : null}
          </View>
        );
      })}

      {result ? (
        <View style={{ marginTop: 14 }}>
          <View style={styles.scoreRow}>
            <MaterialIcons
              name={result.completed ? "check-circle" : "cancel"}
              size={20}
              color={result.completed ? GREEN : RED}
            />
            <Text style={{ color: result.completed ? GREEN : RED, fontWeight: "800" }}>
              Score: {result.score}%
            </Text>
          </View>
          <PressableScale onPress={reset} style={[styles.tryAgain, { borderColor: t.neutral.border, borderRadius: t.radii.pill }]}>
            <MaterialIcons name="refresh" size={18} color={t.palette.primary} />
            <Text style={{ color: t.palette.primary, fontWeight: "700" }}>Try again</Text>
          </PressableScale>
        </View>
      ) : (
        <GradientButton
          label="Check answers"
          onPress={() => submitMutation.mutate()}
          loading={submitMutation.isPending}
          style={{ marginTop: 14 }}
        />
      )}
    </AppCard>
  );
}

interface ItemViewProps {
  kind: string;
  item: ExerciseItem;
  exerciseOptions: string[];
  given: string[];
  order?: ReorderState;
  result?: ItemResult;
  onBlank: (blankIndex: number, value: string) => void;
  onSelect: (value: string) => void;
  onMoveToLine: (tokenIndex: number) => void;
  onMoveToBank: (tokenIndex: number) => void;
}

function ExerciseItemView(props: ItemViewProps) {
  const { kind } = props;
  if (kind === "choose" || kind === "match") return <ChooseItem {...props} />;
  if (kind === "reorder") return <ReorderItem {...props} />;
  if (kind === "fill_blank") return <FillBlankItem {...props} />;
  return <RewriteItem {...props} />;
}

function FillBlankItem({ item, given, result, onBlank }: ItemViewProps) {
  const t = useTokens();
  const count = Math.max(item.blanks || 0, given.length, 1);
  const display = (item.text || "").replace(/___/g, "____");
  const disabled = !!result;
  return (
    <View>
      {display ? (
        <Text variant="bodyMedium" style={{ color: t.neutral.text, lineHeight: 22 }}>
          {display}
        </Text>
      ) : null}
      {Array.from({ length: count }).map((_, idx) => {
        const ok = result?.blanks?.[idx];
        const borderColor = result ? (ok ? GREEN : RED) : t.neutral.border;
        return (
          <TextInput
            key={idx}
            mode="outlined"
            dense
            label={count > 1 ? `Blank ${idx + 1}` : "Your answer"}
            value={given[idx] ?? ""}
            onChangeText={(v) => onBlank(idx, v)}
            disabled={disabled}
            outlineColor={borderColor}
            autoCapitalize="none"
            outlineStyle={{ borderRadius: t.radii.md }}
            style={[styles.input, { marginTop: 8 }]}
          />
        );
      })}
    </View>
  );
}

function RewriteItem({ item, given, result, onSelect }: ItemViewProps) {
  const t = useTokens();
  const ok = result?.correct;
  const borderColor = result ? (ok ? GREEN : RED) : t.neutral.border;
  return (
    <View>
      {item.text ? (
        <Text variant="bodyMedium" style={{ color: t.neutral.text, lineHeight: 22 }}>
          {item.text}
        </Text>
      ) : null}
      <TextInput
        mode="outlined"
        dense
        label="Your answer"
        value={given[0] ?? ""}
        onChangeText={onSelect}
        disabled={!!result}
        outlineColor={borderColor}
        autoCapitalize="none"
        outlineStyle={{ borderRadius: t.radii.md }}
        style={[styles.input, { marginTop: 8 }]}
      />
    </View>
  );
}

function ChooseItem({ item, exerciseOptions, given, result, onSelect }: ItemViewProps) {
  const t = useTokens();
  const opts = item.options && item.options.length ? item.options : exerciseOptions;
  const value = given[0] ?? "";
  return (
    <View>
      {item.text ? (
        <Text variant="bodyMedium" style={{ color: t.neutral.text, lineHeight: 22 }}>
          {item.text}
        </Text>
      ) : null}
      <View style={styles.optionRow}>
        {opts.map((opt) => {
          let tone: "default" | "selected" | "correct" | "wrong" = value === opt ? "selected" : "default";
          if (result) {
            if (opt === result.answers?.[0]) tone = "correct";
            else if (opt === value) tone = "wrong";
            else tone = "default";
          }
          return (
            <TapChip key={opt} label={opt} tone={tone} disabled={!!result} onPress={() => onSelect(opt)} t={t} />
          );
        })}
      </View>
    </View>
  );
}

function ReorderItem({ order, result, onMoveToLine, onMoveToBank }: ItemViewProps) {
  const t = useTokens();
  if (!order) return null;
  const lineColor = result ? (result.correct ? GREEN : RED) : t.neutral.border;
  return (
    <View>
      <View style={[styles.tokenLine, { borderColor: lineColor, borderRadius: t.radii.md }]}>
        {order.line.length === 0 ? (
          <Text style={{ color: t.neutral.textMuted }}>Tap the words in order…</Text>
        ) : (
          order.line.map((tok, ti) => (
            <TapChip key={ti} label={tok} disabled={!!result} onPress={() => onMoveToBank(ti)} tone="selected" t={t} />
          ))
        )}
      </View>
      {!result && order.bank.length > 0 ? (
        <View style={styles.optionRow}>
          {order.bank.map((tok, ti) => (
            <TapChip key={ti} label={tok} onPress={() => onMoveToLine(ti)} t={t} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 120 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  wordChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7 },
  input: { backgroundColor: "transparent" },
  explain: { marginTop: 8, padding: 12 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 9 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tryAgain: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderWidth: 1.5, marginTop: 10 },
  tokenLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    borderWidth: 1.5,
    padding: 10,
    marginTop: 8,
    minHeight: 52,
    alignItems: "center",
  },
  explainHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  practiceHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalCard: { maxHeight: "82%", padding: 20, paddingBottom: 28 },
  modalHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  modalBody: { marginTop: 14 },
  modalLoading: { alignItems: "center", paddingVertical: 20 },
  modalGrid: { flexDirection: "row", gap: 16, marginTop: 12 },
  modalActionsRow: { flexDirection: "row", gap: 10, marginTop: 14, flexWrap: "wrap" },
  pillBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
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

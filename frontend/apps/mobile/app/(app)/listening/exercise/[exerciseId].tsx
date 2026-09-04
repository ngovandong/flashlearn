import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { evaluateDictation, overallDictationScore, tokenDisplay } from "@flashlearn/core";
import type { Highlight, ListeningSentence } from "@flashlearn/core";
import { listeningApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { NotePanel } from "@/components/note/NotePanel";
import { AppCard } from "@/components/ui/AppCard";
import { GradientButton } from "@/components/ui/GradientButton";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { useFloatingTabBarHeight } from "@/components/ui/FloatingTabBar";
import { playAudioUrl, speakText, stopPlayback } from "@/utils/audio";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens, type Tokens } from "@/theme/tokens";

type LineResult = {
  position: number;
  target: string;
  typed: string;
  correct: number;
  total: number;
  tokens_correct: boolean[];
};

interface SentenceMeta {
  translation?: string;
  note?: string;
}

interface ExerciseProgress {
  highlights?: Highlight[];
  sentence_meta?: Record<string, SentenceMeta>;
  best_score?: number;
  last_result?: { lines?: LineResult[] };
}

/** Small icon+label chip used for the audio / reveal / translate controls. */
function ToolChip({
  label,
  icon,
  onPress,
  loading,
  active,
  disabled,
  t,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  loading?: boolean;
  active?: boolean;
  disabled?: boolean;
  t: Tokens;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={loading || disabled}
      style={[
        styles.toolChip,
        {
          backgroundColor: active ? t.primaryAlpha(0.12) : t.neutral.surface2,
          borderRadius: t.radii.pill,
          opacity: loading || disabled ? 0.5 : 1,
        },
      ]}
    >
      <MaterialIcons name={icon as any} size={18} color={t.palette.primary} />
      <Text style={{ color: t.palette.primary, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </PressableScale>
  );
}

function scoreColor(score: number): string {
  if (score === 100) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export default function ListeningExerciseScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const t = useTokens();
  const qc = useQueryClient();
  const tabBarHeight = useFloatingTabBarHeight();
  const [index, setIndex] = useState(0);
  const [inputs, setInputs] = useState<string[]>([]);
  const [results, setResults] = useState<(LineResult | null)[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [bestScore, setBestScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [sentenceMeta, setSentenceMeta] = useState<Record<string, SentenceMeta>>({});
  const [noteDraft, setNoteDraft] = useState("");
  const [translationDraft, setTranslationDraft] = useState("");
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  const initializedFor = useRef<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.listening.exercise(exerciseId!),
    queryFn: async () =>
      unwrap<{
        sentences: ListeningSentence[];
        key?: string;
        title?: string;
        progress?: ExerciseProgress;
      }>(await listeningApi.getExercise(exerciseId!)),
    enabled: !!exerciseId,
  });

  const sentences = useMemo(() => data?.sentences ?? [], [data]);

  // Initialize per-sentence state once per exercise, replaying any saved attempt.
  useEffect(() => {
    if (!data || !exerciseId || initializedFor.current === exerciseId) return;
    initializedFor.current = exerciseId;
    const list = sentences;
    setHighlights(data.progress?.highlights ?? []);
    setSentenceMeta(data.progress?.sentence_meta ?? {});
    setBestScore(data.progress?.best_score ?? 0);

    const prior = data.progress?.last_result?.lines;
    if (Array.isArray(prior) && prior.length) {
      const byPos = new Map(prior.map((l) => [l.position, l]));
      setInputs(list.map((s) => byPos.get(s.position)?.typed || ""));
      setResults(list.map((s) => byPos.get(s.position) ?? null));
      setRevealed(list.map((s) => byPos.has(s.position)));
    } else {
      setInputs(list.map(() => ""));
      setResults(list.map(() => null));
      setRevealed(list.map(() => false));
    }
    setIndex(0);
    setFinished(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, exerciseId]);

  // Stop any playing clip on unmount.
  useEffect(() => () => stopPlayback(), []);

  const current = sentences[index];
  const posKey = current ? String(current.position) : "";
  const currentMeta = posKey ? sentenceMeta[posKey] : undefined;
  const currentResult = results[index] ?? null;
  const isRevealed = !!revealed[index];

  // Reset the note/translation drafts whenever the active sentence changes so
  // edits (or a Save) never leak onto a different sentence's saved meta.
  useEffect(() => {
    setNoteDraft(currentMeta?.note ?? "");
    setTranslationDraft(currentMeta?.translation ?? "");
    setSelectedWord(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, exerciseId]);

  const saveProgressMutation = useMutation({
    mutationFn: (payload: LineResult[]) =>
      listeningApi.saveProgress({ exerciseId: exerciseId!, lines: payload }),
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: { score: number; lines: LineResult[] }) =>
      unwrap<{ progress?: { best_score?: number } }>(
        await listeningApi.submit({ exerciseId: exerciseId!, ...payload })
      ),
    onSuccess: () => {
      // Refresh the topic catalog / progress so the completion badge and
      // best-score don't stay stale for a full staleTime window.
      qc.invalidateQueries({ queryKey: ["listening"] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => listeningApi.resetProgress(exerciseId!),
  });

  const highlightMutation = useMutation({
    mutationFn: async (payload: { text: string; note?: string; remove?: boolean }) => {
      const res = await listeningApi.setHighlight(exerciseId!, payload);
      return unwrap<{ highlights: Highlight[] }>(res);
    },
    onSuccess: (res) => setHighlights(res.highlights ?? []),
  });

  const metaMutation = useMutation({
    mutationFn: async (payload: { position: number; translation?: string; note?: string }) => {
      const res = await listeningApi.saveSentenceMeta(exerciseId!, payload);
      return unwrap<{ sentence_meta: Record<string, SentenceMeta> }>(res);
    },
    onSuccess: (res) => setSentenceMeta(res.sentence_meta ?? {}),
  });

  const translateMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await listeningApi.translate({ text });
      return unwrap<{ translation?: string }>(res);
    },
    onSuccess: (res) => {
      if (res.translation) setTranslationDraft(res.translation);
    },
  });

  const setInput = (i: number, value: string) =>
    setInputs((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });

  const persistProgress = (resultsArr: (LineResult | null)[], revealedArr: boolean[]) => {
    const partial = sentences
      .map((s, i) => ({ s, i }))
      .filter(({ i }) => revealedArr[i])
      .map(({ s, i }) => resultsArr[i] ?? { position: s.position, target: s.text ?? "", typed: "", correct: 0, total: s.tokens?.length ?? 0, tokens_correct: [] });
    saveProgressMutation.mutate(partial);
  };

  const evalCurrent = (): LineResult => {
    const evalResult = evaluateDictation(current?.tokens ?? [], inputs[index] || "");
    return {
      position: current?.position ?? index,
      target: current?.text ?? "",
      typed: inputs[index] || "",
      correct: evalResult.correct,
      total: evalResult.total,
      tokens_correct: evalResult.tokensCorrect,
    };
  };

  const checkLine = () => {
    if (!current) return;
    const line = evalCurrent();
    const nextResults = [...results];
    nextResults[index] = line;
    const nextRevealed = [...revealed];
    nextRevealed[index] = true;
    setResults(nextResults);
    setRevealed(nextRevealed);
    persistProgress(nextResults, nextRevealed);
  };

  const revealLine = () => {
    if (!current) return;
    const nextResults = [...results];
    if (!nextResults[index]) nextResults[index] = evalCurrent();
    const nextRevealed = [...revealed];
    nextRevealed[index] = true;
    setResults(nextResults);
    setRevealed(nextRevealed);
    persistProgress(nextResults, nextRevealed);
  };

  const restartLine = () => {
    stopPlayback();
    setInput(index, "");
    const nextResults = [...results];
    nextResults[index] = null;
    const nextRevealed = [...revealed];
    nextRevealed[index] = false;
    setResults(nextResults);
    setRevealed(nextRevealed);
    persistProgress(nextResults, nextRevealed);
  };

  const goTo = (i: number) => {
    if (i < 0 || i >= sentences.length) return;
    stopPlayback();
    setIndex(i);
  };

  const finish = async () => {
    stopPlayback();
    // Any sentence the learner typed but never explicitly Checked/Revealed
    // should still be graded against their typed answer, not scored as 0.
    const finalResults = sentences.map((s, i) => {
      if (results[i]) return results[i]!;
      const evalResult = evaluateDictation(s.tokens ?? [], inputs[i] || "");
      return {
        position: s.position,
        target: s.text ?? "",
        typed: inputs[i] || "",
        correct: evalResult.correct,
        total: evalResult.total,
        tokens_correct: evalResult.tokensCorrect,
      };
    });
    setResults(finalResults);
    setRevealed(sentences.map(() => true));
    setFinished(true);
    const score = overallDictationScore(finalResults);
    try {
      const res = await submitMutation.mutateAsync({ score, lines: finalResults });
      setBestScore((b) => Math.max(b, res.progress?.best_score ?? score));
    } catch {
      /* score still shown locally even if the save failed */
    }
  };

  const restartAll = async () => {
    stopPlayback();
    setInputs(sentences.map(() => ""));
    setResults(sentences.map(() => null));
    setRevealed(sentences.map(() => false));
    setFinished(false);
    setIndex(0);
    resetMutation.mutate();
  };

  const playSentence = async (rate = 1) => {
    if (!current) return;
    setPlaybackError(null);
    if (!current.audio_url) {
      await speakText(current.text ?? "");
      return;
    }
    const res = await playAudioUrl(current.audio_url, rate);
    if (!res.ok) {
      // Fall back to on-device speech so the learner isn't stuck without audio.
      await speakText(current.text ?? "");
      setPlaybackError("Couldn't stream this clip — using device speech instead.");
    }
  };

  const saveNote = () => {
    if (!selectedWord) return;
    highlightMutation.mutate({ text: selectedWord, note: noteDraft });
    setSelectedWord(null);
    setNoteDraft("");
  };

  const saveSentenceNote = () => {
    if (!current) return;
    // Send the trimmed draft as-is (including "") so clearing a note or
    // translation actually clears it server-side instead of being ignored.
    metaMutation.mutate({
      position: current.position,
      note: noteDraft.trim(),
      translation: translationDraft.trim(),
    });
  };

  if (isLoading) return <LoadingView />;
  if (isError) return <ErrorView message="Could not load exercise" onRetry={() => refetch()} />;

  if (finished) {
    const score = overallDictationScore(results.filter((r): r is LineResult => !!r));
    return (
      <ScrollView style={{ backgroundColor: t.neutral.bg }} contentContainerStyle={styles.center}>
        <FadeSlideIn>
          <View style={styles.doneInner}>
            <ProgressRing value={score} size={140} strokeWidth={12} />
            <Text variant="headlineSmall" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 20 }}>
              Exercise complete
            </Text>
            <Text variant="bodyMedium" style={{ color: t.neutral.textMinor, marginTop: 4 }}>
              {revealed.filter(Boolean).length} / {sentences.length} sentences · best {bestScore}%
            </Text>
            <View style={styles.doneActions}>
              <GradientButton label="Practice again" icon="replay" onPress={restartAll} style={{ flex: 1 }} />
            </View>
          </View>
        </FadeSlideIn>
      </ScrollView>
    );
  }

  const progress = sentences.length ? (index + 1) / sentences.length : 0;

  return (
    <ScrollView style={{ backgroundColor: t.neutral.bg }} contentContainerStyle={[styles.pad, { paddingBottom: tabBarHeight }]} showsVerticalScrollIndicator={false}>
      <FadeSlideIn>
        <View style={styles.progressHead}>
          <Text variant="labelLarge" style={{ color: t.neutral.textMinor, fontWeight: "700" }}>
            Sentence {index + 1} of {sentences.length}
          </Text>
          <View style={styles.rowCenter}>
            {bestScore > 0 ? (
              <View style={styles.rowCenter}>
                <MaterialIcons name="emoji-events" size={16} color={t.palette.primary} />
                <Text style={{ color: t.palette.primary, fontWeight: "800" }}>{bestScore}%</Text>
              </View>
            ) : null}
            <PressableScale onPress={restartAll} hitSlop={8}>
              <MaterialIcons name="restart-alt" size={20} color={t.neutral.textMinor} />
            </PressableScale>
          </View>
        </View>

        {/* Per-sentence progress dots */}
        <View style={styles.dots}>
          {sentences.map((s, i) => {
            const done = revealed[i];
            const score = results[i]?.total ? Math.round(((results[i]?.correct ?? 0) / (results[i]!.total || 1)) * 100) : null;
            const dotColor = done
              ? scoreColor(score ?? 0)
              : i === index
                ? t.palette.primary
                : t.neutral.surface2;
            return (
              <PressableScale key={s.position ?? i} onPress={() => goTo(i)} hitSlop={4}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: dotColor,
                      borderColor: i === index ? t.palette.primary : "transparent",
                    },
                  ]}
                />
              </PressableScale>
            );
          })}
        </View>
      </FadeSlideIn>

      {highlights.length > 0 ? (
        <View style={styles.chips}>
          {highlights.map((h) => (
            <PressableScale
              key={h.text}
              onPress={() => { setSelectedWord(h.text); setNoteDraft(h.note ?? ""); }}
              style={[styles.wordChip, { backgroundColor: t.feature("spellcheck").tint, borderRadius: t.radii.pill }]}
            >
              <Text style={{ color: t.feature("spellcheck").fg, fontWeight: "700", fontSize: 13 }}>{h.text}</Text>
            </PressableScale>
          ))}
        </View>
      ) : null}

      {playbackError ? (
        <Text style={{ color: t.palette.primary, marginTop: 10 }}>{playbackError}</Text>
      ) : null}

      <FadeSlideIn delay={50}>
        <AppCard style={{ marginTop: 16 }}>
          <View style={styles.toolRow}>
            <ToolChip label="Play" icon="volume-up" onPress={() => playSentence(1)} t={t} />
            <ToolChip label="Slow" icon="slow-motion-video" onPress={() => playSentence(0.6)} t={t} />
            <ToolChip label="Restart" icon="replay" onPress={restartLine} t={t} />
          </View>

          {current?.hint ? (
            <Text variant="bodySmall" style={{ color: t.neutral.textMinor, marginTop: 12 }}>
              Hint: {current.hint}
            </Text>
          ) : null}

          <TextInput
            mode="outlined"
            label="Type what you hear"
            value={inputs[index] || ""}
            onChangeText={(v) => setInput(index, v)}
            editable={!isRevealed}
            multiline
            outlineStyle={{ borderRadius: t.radii.md }}
            style={[styles.input, { marginTop: 14 }]}
          />

          <View style={styles.toolRow}>
            <ToolChip label="Translate" icon="translate" onPress={() => current?.text && translateMutation.mutate(current.text)} loading={translateMutation.isPending} t={t} />
          </View>

          {!isRevealed ? (
            <View style={styles.actionsRow}>
              <ToolChip label="Reveal" icon="visibility" onPress={revealLine} t={t} />
              <GradientButton
                label="Check"
                icon="check"
                onPress={checkLine}
                disabled={!(inputs[index] || "").trim()}
                style={{ flex: 1 }}
              />
            </View>
          ) : (
            <View style={{ marginTop: 14 }}>
              <View
                style={[
                  styles.scoreBadge,
                  { backgroundColor: t.alpha(scoreColor(currentResult?.total ? Math.round((currentResult.correct / currentResult.total) * 100) : 0), 0.12) },
                ]}
              >
                <MaterialIcons
                  name={currentResult?.total && currentResult.correct === currentResult.total ? "check-circle" : "info"}
                  size={18}
                  color={scoreColor(currentResult?.total ? Math.round((currentResult.correct / currentResult.total) * 100) : 0)}
                />
                <Text style={{ color: scoreColor(currentResult?.total ? Math.round((currentResult.correct / currentResult.total) * 100) : 0), fontWeight: "800" }}>
                  {currentResult ? `${currentResult.correct}/${currentResult.total} words · ${currentResult.total ? Math.round((currentResult.correct / currentResult.total) * 100) : 0}%` : ""}
                </Text>
              </View>

              <Text variant="labelMedium" style={{ color: t.neutral.textMinor, fontWeight: "700", marginTop: 12 }}>
                Correct answer
              </Text>
              <Text style={{ marginTop: 4, lineHeight: 24 }}>
                {(current?.tokens ?? []).map((tok, i) => {
                  const disp = tokenDisplay(tok);
                  const ok = currentResult?.tokens_correct ? currentResult.tokens_correct[i] : true;
                  return (
                    <Text
                      key={i}
                      style={{
                        color: ok ? t.neutral.text : "#ef4444",
                        fontWeight: ok ? "400" : "700",
                        textDecorationLine: ok ? "none" : "underline",
                      }}
                    >
                      {disp}{" "}
                    </Text>
                  );
                })}
              </Text>

              {(inputs[index] || "").trim() ? (
                <>
                  <Text variant="labelMedium" style={{ color: t.neutral.textMinor, fontWeight: "700", marginTop: 10 }}>
                    You typed
                  </Text>
                  <Text style={{ color: t.neutral.textMinor, marginTop: 2 }}>{inputs[index]}</Text>
                </>
              ) : null}

              {current?.explanation ? (
                <Text style={{ color: t.neutral.textMinor, marginTop: 10 }}>{current.explanation}</Text>
              ) : null}
            </View>
          )}

          {translationDraft || currentMeta?.translation ? (
            <Text style={{ color: t.neutral.textMinor, marginTop: 10 }}>
              Translation: {translationDraft || currentMeta?.translation}
            </Text>
          ) : null}

          <View style={styles.navRow}>
            <ToolChip label="Prev" icon="chevron-left" onPress={() => goTo(index - 1)} disabled={index === 0} t={t} />
            {isRevealed ? (
              index < sentences.length - 1 ? (
                <GradientButton label="Next" icon="chevron-right" onPress={() => goTo(index + 1)} style={{ flex: 1 }} />
              ) : (
                <GradientButton label="Finish" icon="emoji-events" onPress={finish} style={{ flex: 1 }} />
              )
            ) : null}
          </View>
        </AppCard>
      </FadeSlideIn>

      <FadeSlideIn delay={90}>
        <AppCard style={{ marginTop: 14 }}>
          <TextInput
            mode="outlined"
            label="Sentence note"
            value={noteDraft || currentMeta?.note || ""}
            onChangeText={setNoteDraft}
            multiline
            outlineStyle={{ borderRadius: t.radii.md }}
            style={styles.input}
          />
          <PressableScale onPress={saveSentenceNote} hitSlop={8} style={{ alignSelf: "flex-start", marginTop: 8 }}>
            <Text style={{ color: t.palette.primary, fontWeight: "700" }}>Save note</Text>
          </PressableScale>
        </AppCard>
      </FadeSlideIn>

      {selectedWord ? (
        <AppCard style={{ marginTop: 14 }}>
          <Text variant="labelLarge" style={{ color: t.neutral.text, fontWeight: "700" }}>
            Note for “{selectedWord}”
          </Text>
          <TextInput mode="outlined" value={noteDraft} onChangeText={setNoteDraft} multiline outlineStyle={{ borderRadius: t.radii.md }} style={[styles.input, { marginTop: 8 }]} />
          <View style={styles.toolRow}>
            <GradientButton label="Save highlight" onPress={saveNote} loading={highlightMutation.isPending} style={{ flex: 1 }} />
            <PressableScale onPress={() => setSelectedWord(null)} style={[styles.cancelBtn, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}>
              <Text style={{ color: t.neutral.textMinor, fontWeight: "700" }}>Cancel</Text>
            </PressableScale>
          </View>
        </AppCard>
      ) : null}

      <NotePanel
        targetType="listening_exercise"
        targetKey={data?.key}
        title={data?.title}
        targetUrl={`/listening/exercise/${exerciseId}`}
        label="Exercise notes"
      />

      <Text variant="bodySmall" style={{ color: t.neutral.textMuted, marginTop: 16, textAlign: "center" }}>
        Progress auto-saves after each checked sentence.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 120 },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  doneInner: { alignItems: "center", width: "100%" },
  doneActions: { flexDirection: "row", gap: 10, marginTop: 24, width: "100%" },
  progressHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 10 },
  dots: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  wordChip: { paddingHorizontal: 12, paddingVertical: 7 },
  input: { backgroundColor: "transparent" },
  toolRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12, alignItems: "center" },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14, alignItems: "center" },
  navRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14, alignItems: "center" },
  toolChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  scoreBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  cancelBtn: { paddingHorizontal: 20, height: 52, alignItems: "center", justifyContent: "center" },
});

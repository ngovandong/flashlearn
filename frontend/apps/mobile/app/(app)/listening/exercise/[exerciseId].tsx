import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { evaluateDictation, overallDictationScore } from "@flashlearn/core";
import type { Highlight, ListeningSentence } from "@flashlearn/core";
import { listeningApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { AppCard } from "@/components/ui/AppCard";
import { GradientButton } from "@/components/ui/GradientButton";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { AnimatedBar } from "@/components/ui/AnimatedBar";
import { playAudioUrl } from "@/utils/audio";
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

/** Small icon+label chip used for the audio / reveal / translate controls. */
function ToolChip({
  label,
  icon,
  onPress,
  loading,
  active,
  t,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  loading?: boolean;
  active?: boolean;
  t: Tokens;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={loading}
      style={[
        styles.toolChip,
        {
          backgroundColor: active ? t.primaryAlpha(0.12) : t.neutral.surface2,
          borderRadius: t.radii.pill,
          opacity: loading ? 0.6 : 1,
        },
      ]}
    >
      <MaterialIcons name={icon as any} size={18} color={t.palette.primary} />
      <Text style={{ color: t.palette.primary, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </PressableScale>
  );
}

export default function ListeningExerciseScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const t = useTokens();
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [lines, setLines] = useState<LineResult[]>([]);
  const [done, setDone] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [sentenceMeta, setSentenceMeta] = useState<Record<string, SentenceMeta>>({});
  const [noteDraft, setNoteDraft] = useState("");
  const [translationDraft, setTranslationDraft] = useState("");
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.listening.exercise(exerciseId!),
    queryFn: async () =>
      unwrap<{
        sentences: ListeningSentence[];
        title?: string;
        progress?: {
          highlights?: Highlight[];
          sentence_meta?: Record<string, SentenceMeta>;
          last_result?: { lines?: LineResult[] };
        };
      }>(await listeningApi.getExercise(exerciseId!)),
    enabled: !!exerciseId,
  });

  useEffect(() => {
    if (!data?.progress) return;
    setHighlights(data.progress.highlights ?? []);
    setSentenceMeta(data.progress.sentence_meta ?? {});
    const saved = data.progress.last_result?.lines;
    if (saved?.length) {
      setLines(saved);
      setIndex(Math.min(saved.length, (data.sentences?.length ?? 1) - 1));
    }
  }, [data]);

  const saveProgressMutation = useMutation({
    mutationFn: (payload: LineResult[]) =>
      listeningApi.saveProgress({ exerciseId: exerciseId!, lines: payload }),
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: { score: number; lines: LineResult[] }) =>
      listeningApi.submit({ exerciseId: exerciseId!, ...payload }),
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

  const sentences = data?.sentences ?? [];
  const current = sentences[index];
  const posKey = current ? String(current.position) : "";
  const currentMeta = posKey ? sentenceMeta[posKey] : undefined;

  const checkLine = () => {
    if (!current) return;
    const evalResult = evaluateDictation(current.tokens ?? [], typed);
    const line: LineResult = {
      position: current.position,
      target: current.text ?? "",
      typed,
      correct: evalResult.correct,
      total: evalResult.total,
      tokens_correct: evalResult.tokensCorrect,
    };
    const nextLines = [...lines.filter((l) => l.position !== line.position), line].sort(
      (a, b) => a.position - b.position
    );
    setLines(nextLines);
    setTyped("");
    setRevealed(false);
    setTranslationDraft("");
    saveProgressMutation.mutate(nextLines);

    if (index + 1 >= sentences.length) {
      const score = overallDictationScore(nextLines);
      submitMutation.mutate({ score, lines: nextLines });
      setDone(true);
    } else {
      setIndex((i) => i + 1);
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
    metaMutation.mutate({
      position: current.position,
      note: noteDraft || undefined,
      translation: translationDraft || undefined,
    });
    setNoteDraft("");
  };

  if (isLoading) return <LoadingView />;
  if (isError) return <ErrorView message="Could not load exercise" onRetry={() => refetch()} />;

  if (done) {
    const score = overallDictationScore(lines);
    return (
      <View style={[styles.center, { backgroundColor: t.neutral.bg }]}>
        <FadeSlideIn>
          <View style={styles.doneInner}>
            <ProgressRing value={score} size={140} strokeWidth={12} />
            <Text variant="headlineSmall" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 20 }}>
              Exercise complete
            </Text>
            <Text variant="bodyMedium" style={{ color: t.neutral.textMinor, marginTop: 4 }}>
              Great listening work!
            </Text>
          </View>
        </FadeSlideIn>
      </View>
    );
  }

  const progress = sentences.length ? (index + 1) / sentences.length : 0;

  return (
    <ScrollView style={{ backgroundColor: t.neutral.bg }} contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
      <FadeSlideIn>
        <View style={styles.progressHead}>
          <Text variant="labelLarge" style={{ color: t.neutral.textMinor, fontWeight: "700" }}>
            Sentence {index + 1} of {sentences.length}
          </Text>
          <Text variant="labelLarge" style={{ color: t.palette.primary, fontWeight: "800" }}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
        <AnimatedBar progress={progress} color={t.palette.primary} trackColor={t.neutral.surface2} style={{ marginTop: 8 }} />
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

      <FadeSlideIn delay={50}>
        <AppCard style={{ marginTop: 16 }}>
          {current?.audio_url ? (
            <View style={styles.toolRow}>
              <ToolChip label="Play" icon="volume-up" onPress={() => playAudioUrl(current.audio_url!)} t={t} />
              <ToolChip label="Slow" icon="slow-motion-video" onPress={() => playAudioUrl(current.audio_url!, 0.6)} t={t} />
            </View>
          ) : null}

          {current?.hint ? (
            <Text variant="bodySmall" style={{ color: t.neutral.textMinor, marginTop: 12 }}>
              Hint: {current.hint}
            </Text>
          ) : null}

          <TextInput
            mode="outlined"
            label="Type what you hear"
            value={typed}
            onChangeText={setTyped}
            multiline
            outlineStyle={{ borderRadius: t.radii.md }}
            style={[styles.input, { marginTop: 14 }]}
          />

          <View style={styles.toolRow}>
            <ToolChip label={revealed ? "Hide" : "Reveal"} icon={revealed ? "visibility-off" : "visibility"} onPress={() => setRevealed((r) => !r)} active={revealed} t={t} />
            <ToolChip label="Translate" icon="translate" onPress={() => current?.text && translateMutation.mutate(current.text)} loading={translateMutation.isPending} t={t} />
          </View>

          <GradientButton label="Check" icon="check" onPress={checkLine} disabled={!typed.trim()} style={{ marginTop: 14 }} />

          {revealed && current?.text ? (
            <View style={[styles.reveal, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.md }]}>
              <Text variant="labelMedium" style={{ color: t.neutral.textMinor, fontWeight: "700" }}>
                Answer
              </Text>
              <Text variant="titleMedium" style={{ color: t.neutral.text, marginTop: 2 }}>
                {current.text}
              </Text>
            </View>
          ) : null}

          {translationDraft || currentMeta?.translation ? (
            <Text style={{ color: t.neutral.textMinor, marginTop: 10 }}>
              Translation: {translationDraft || currentMeta?.translation}
            </Text>
          ) : null}
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

          {current?.explanation ? (
            <>
              <Text variant="titleSmall" style={{ color: t.neutral.text, fontWeight: "700", marginTop: 12 }}>
                Explanation
              </Text>
              <Text style={{ color: t.neutral.textMinor, marginTop: 2 }}>{current.explanation}</Text>
            </>
          ) : null}
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

      <Text variant="bodySmall" style={{ color: t.neutral.textMuted, marginTop: 16, textAlign: "center" }}>
        Progress auto-saves after each checked sentence.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 120 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  doneInner: { alignItems: "center" },
  progressHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  wordChip: { paddingHorizontal: 12, paddingVertical: 7 },
  input: { backgroundColor: "transparent" },
  toolRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12, alignItems: "center" },
  toolChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  reveal: { marginTop: 12, padding: 12 },
  cancelBtn: { paddingHorizontal: 20, height: 52, alignItems: "center", justifyContent: "center" },
});

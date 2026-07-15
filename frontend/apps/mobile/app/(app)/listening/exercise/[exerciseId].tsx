import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Chip, Text, TextInput, useTheme } from "react-native-paper";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { evaluateDictation, overallDictationScore } from "@flashlearn/core";
import type { Highlight, ListeningSentence } from "@flashlearn/core";
import { listeningApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { playAudioUrl } from "@/utils/audio";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";

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

export default function ListeningExerciseScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const theme = useTheme();
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
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
          Exercise complete
        </Text>
        <Text variant="titleLarge" style={{ color: theme.colors.primary, marginTop: 8 }}>
          {score}%
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.pad, { backgroundColor: theme.colors.background }]}>
      <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
        Sentence {index + 1} / {sentences.length}
      </Text>

      {highlights.length > 0 ? (
        <View style={styles.chips}>
          {highlights.map((h) => (
            <Chip
              key={h.text}
              onPress={() => { setSelectedWord(h.text); setNoteDraft(h.note ?? ""); }}
              style={{ marginRight: 6, marginBottom: 6 }}
            >
              {h.text}
            </Chip>
          ))}
        </View>
      ) : null}

      {current?.audio_url ? (
        <View style={styles.row}>
          <Button mode="contained-tonal" icon="volume-high" onPress={() => playAudioUrl(current.audio_url!)}>
            Play
          </Button>
          <Button mode="outlined" icon="turtle" onPress={() => playAudioUrl(current.audio_url!, 0.6)}>
            Slow
          </Button>
        </View>
      ) : null}

      {current?.hint ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
          Hint: {current.hint}
        </Text>
      ) : null}

      <TextInput
        mode="outlined"
        label="Type what you hear"
        value={typed}
        onChangeText={setTyped}
        multiline
        style={{ marginTop: 16 }}
      />

      <View style={styles.row}>
        <Button mode="contained" onPress={checkLine} disabled={!typed.trim()}>
          Check
        </Button>
        <Button mode="outlined" icon={revealed ? "eye-off" : "eye"} onPress={() => setRevealed((r) => !r)}>
          {revealed ? "Hide" : "Reveal"}
        </Button>
        <Button mode="outlined" onPress={() => current?.text && translateMutation.mutate(current.text)} loading={translateMutation.isPending}>
          Translate
        </Button>
      </View>

      {revealed && current?.text ? (
        <View style={[styles.reveal, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Answer
          </Text>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: 2 }}>
            {current.text}
          </Text>
        </View>
      ) : null}

      {translationDraft || currentMeta?.translation ? (
        <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
          Translation: {translationDraft || currentMeta?.translation}
        </Text>
      ) : null}

      <TextInput
        mode="outlined"
        label="Sentence note"
        value={noteDraft || currentMeta?.note || ""}
        onChangeText={setNoteDraft}
        multiline
        style={{ marginTop: 12 }}
      />
      <Button mode="text" onPress={saveSentenceNote}>
        Save note
      </Button>

      {current?.explanation ? (
        <>
          <Text variant="titleSmall" style={{ color: theme.colors.onSurface, marginTop: 12 }}>
            Explanation
          </Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>{current.explanation}</Text>
        </>
      ) : null}

      {selectedWord ? (
        <View style={[styles.noteBox, { borderColor: theme.colors.outlineVariant }]}>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
            Note for “{selectedWord}”
          </Text>
          <TextInput mode="outlined" value={noteDraft} onChangeText={setNoteDraft} multiline style={{ marginTop: 8 }} />
          <View style={styles.row}>
            <Button mode="contained" onPress={saveNote} loading={highlightMutation.isPending}>
              Save highlight
            </Button>
            <Button mode="text" onPress={() => setSelectedWord(null)}>
              Cancel
            </Button>
          </View>
        </View>
      ) : null}

      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
        Progress auto-saves after each checked sentence.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  noteBox: { marginTop: 16, padding: 12, borderWidth: 1, borderRadius: 10 },
  reveal: { marginTop: 12, padding: 12, borderRadius: 10 },
});

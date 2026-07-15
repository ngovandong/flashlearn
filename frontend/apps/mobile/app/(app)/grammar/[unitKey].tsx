import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Chip, Text, TextInput, useTheme } from "react-native-paper";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { GrammarExercise, Highlight } from "@flashlearn/core";
import { grammarApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";

interface GradeItemResult {
  blanks?: boolean[];
  correct?: boolean;
  answers?: string[];
  given?: string[];
}

interface GradeResult {
  score?: number;
  results?: GradeItemResult[];
}

export default function GrammarUnitScreen() {
  const { unitKey } = useLocalSearchParams<{ unitKey: string }>();
  const theme = useTheme();
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [currentBlanks, setCurrentBlanks] = useState<string[]>([""]);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [explain, setExplain] = useState<{ answer?: string; examples?: string[]; tip?: string } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.grammar.unit(unitKey!),
    queryFn: async () =>
      unwrap<{
        title?: string;
        explanation?: string | string[];
        exercises: GrammarExercise[];
        progress?: { highlights?: Highlight[] };
      }>(await grammarApi.getUnit(unitKey!)),
    enabled: !!unitKey,
  });

  React.useEffect(() => {
    if (data?.progress?.highlights) setHighlights(data.progress.highlights);
  }, [data?.progress?.highlights]);

  const submitMutation = useMutation({
    mutationFn: async (exercise: GrammarExercise) => {
      const res = await grammarApi.submitExercise(exercise.key, [currentBlanks]);
      return unwrap<GradeResult>(res);
    },
    onSuccess: (res) => setResult(res),
  });

  const highlightMutation = useMutation({
    mutationFn: async (payload: { text: string; note?: string; remove?: boolean }) => {
      const res = await grammarApi.setHighlight(unitKey!, payload);
      return unwrap<{ highlights: Highlight[] }>(res);
    },
    onSuccess: (res) => setHighlights(res.highlights ?? []),
  });

  const explainMutation = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const res = await grammarApi.explain(payload);
      return unwrap<{ answer?: string; examples?: string[]; tip?: string }>(res);
    },
    onSuccess: (res) => setExplain(res),
  });

  if (isLoading) return <LoadingView />;
  if (isError) return <ErrorView message="Could not load unit" onRetry={() => refetch()} />;

  const exercises = data?.exercises ?? [];
  const exercise = exercises[exerciseIndex];
  const explanationText = Array.isArray(data?.explanation)
    ? data!.explanation.join("\n")
    : data?.explanation ?? "";

  const requestExplain = () => {
    const wrong = result?.results?.find((r) => !r.correct);
    explainMutation.mutate({
      unit_title: data?.title ?? "",
      question: exercise?.prompt ?? exercise?.title ?? "",
      given: (wrong?.given ?? []).join(" "),
      correct: (wrong?.answers ?? []).join(" "),
    });
  };

  const saveHighlight = () => {
    if (!selectedWord) return;
    highlightMutation.mutate({ text: selectedWord, note: noteDraft });
    setSelectedWord(null);
    setNoteDraft("");
  };

  return (
    <ScrollView contentContainerStyle={[styles.pad, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
        {data?.title}
      </Text>
      {explanationText ? (
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
          {explanationText}
        </Text>
      ) : null}

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

      {exercise ? (
        <View style={[styles.card, { borderColor: theme.colors.outlineVariant, marginTop: 20 }]}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
            {exercise.prompt ?? exercise.title}
          </Text>
          <TextInput
            mode="outlined"
            label="Your answer"
            value={currentBlanks[0]}
            onChangeText={(v) => setCurrentBlanks([v])}
            style={{ marginTop: 12 }}
          />
          <Button
            mode="contained"
            onPress={() => submitMutation.mutate(exercise)}
            loading={submitMutation.isPending}
            style={{ marginTop: 12 }}
          >
            Submit
          </Button>
          {result ? (
            <>
              <Text style={{ color: theme.colors.primary, marginTop: 8 }}>
                Score: {result.score}%
              </Text>
              {(result.results ?? []).map((r, i) => (
                <Text key={i} style={{ color: r.correct ? "#2e7d32" : theme.colors.error, marginTop: 4 }}>
                  {r.correct ? "✓" : "✗"} Expected: {(r.answers ?? []).join(", ")}
                </Text>
              ))}
              <Button mode="outlined" onPress={requestExplain} loading={explainMutation.isPending} style={{ marginTop: 8 }}>
                Ask Dragon to explain
              </Button>
            </>
          ) : null}
          {explain ? (
            <View style={[styles.explain, { backgroundColor: theme.colors.surfaceVariant }]}>
              {explain.answer ? (
                <Text style={{ color: theme.colors.onSurface }}>{explain.answer}</Text>
              ) : null}
              {explain.tip ? (
                <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>{explain.tip}</Text>
              ) : null}
            </View>
          ) : null}
          <Button
            mode="text"
            onPress={() => {
              setExerciseIndex((i) => Math.min(i + 1, exercises.length - 1));
              setCurrentBlanks([""]);
              setResult(null);
              setExplain(null);
            }}
            disabled={exerciseIndex >= exercises.length - 1}
            style={{ marginTop: 8 }}
          >
            Next exercise
          </Button>
        </View>
      ) : null}

      {selectedWord ? (
        <View style={[styles.card, { borderColor: theme.colors.outlineVariant, marginTop: 12 }]}>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
            Highlight “{selectedWord}”
          </Text>
          <TextInput mode="outlined" value={noteDraft} onChangeText={setNoteDraft} multiline style={{ marginTop: 8 }} />
          <Button mode="contained" onPress={saveHighlight} loading={highlightMutation.isPending} style={{ marginTop: 8 }}>
            Save
          </Button>
        </View>
      ) : null}

      {explanationText ? (
        <Button
          mode="text"
          onPress={() => {
            const word = explanationText.split(/\s+/).find((w) => w.length > 4) ?? "";
            if (word) setSelectedWord(word.replace(/[^\w'-]/g, ""));
          }}
          style={{ marginTop: 8 }}
        >
          Highlight a word from the explanation
        </Button>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", marginTop: 12 },
  explain: { marginTop: 12, padding: 12, borderRadius: 10 },
});

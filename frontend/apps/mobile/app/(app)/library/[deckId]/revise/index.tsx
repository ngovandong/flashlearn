import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, IconButton, ProgressBar, Text, useTheme } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { generateQuestions, QUESTION_TYPES } from "@flashlearn/core";
import type { Question, Term } from "@flashlearn/core";
import { learningApi, userSettingsApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { FillQuestion } from "@/features/study/FillQuestion";
import { QuizQuestion } from "@/features/study/QuizQuestion";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";

export default function DeckReviseScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const theme = useTheme();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.learning.reviseTerms(deckId!),
    queryFn: async () =>
      unwrap<{ revise_terms: Term[]; all_terms: Term[] }>(
        await learningApi.getReviseTerms(deckId!)
      ),
    enabled: !!deckId,
  });

  const questions: Question[] = useMemo(() => {
    if (!data?.revise_terms?.length) return [];
    return generateQuestions(data.revise_terms, data.all_terms ?? []);
  }, [data]);

  useEffect(() => {
    if (data && data.revise_terms?.length === 0) router.back();
  }, [data, router]);

  const current = questions[index];
  const progress = questions.length ? (index + (done ? 1 : 0)) / questions.length : 0;

  const onAnswer = async (correct: boolean) => {
    setDisabled(true);
    if (correct) setScore((s) => s + 1);
    const progressId = current?.progressId;
    if (progressId) {
      if (correct) await learningApi.correct(progressId);
      else await learningApi.incorrect(progressId);
    }
    setTimeout(async () => {
      setDisabled(false);
      if (index + 1 >= questions.length) {
        setDone(true);
        await userSettingsApi.recordStudyActivity();
      } else {
        setIndex((i) => i + 1);
      }
    }, 600);
  };

  if (isLoading) return <LoadingView />;
  if (isError) return <ErrorView message="Could not load revise terms" onRetry={() => refetch()} />;
  if (!current && !done) return <LoadingView />;

  if (done) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
          Round complete!
        </Text>
        <Text variant="titleMedium" style={{ color: theme.colors.primary, marginTop: 8 }}>
          {score} / {questions.length} correct
        </Text>
        <Button mode="contained" onPress={() => router.back()} style={{ marginTop: 24 }}>
          Back to deck
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <IconButton icon="close" onPress={() => router.back()} />
        <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          {index + 1} / {questions.length}
        </Text>
        <View style={{ width: 48 }} />
      </View>
      <ProgressBar progress={progress} style={{ marginHorizontal: 16 }} />
      {current?.type === QUESTION_TYPES.QUIZ ? (
        <QuizQuestion question={current} onAnswer={onAnswer} disabled={disabled} />
      ) : (
        <FillQuestion question={current} onAnswer={onAnswer} disabled={disabled} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});

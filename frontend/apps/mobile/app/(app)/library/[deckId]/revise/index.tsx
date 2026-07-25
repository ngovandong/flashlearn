import React, { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { generateQuestions, QUESTION_TYPES, resolveImageUrl } from "@flashlearn/core";
import type { Question, Term } from "@flashlearn/core";
import { learningApi, userSettingsApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { GradientButton } from "@/components/ui/GradientButton";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { AnimatedBar } from "@/components/ui/AnimatedBar";
import { FillQuestion } from "@/features/study/FillQuestion";
import { QuizQuestion } from "@/features/study/QuizQuestion";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { speakText } from "@/utils/audio";
import { useTokens } from "@/theme/tokens";

export default function DeckReviseScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const t = useTokens();
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
    if (current?.answer) speakText(current.answer);
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
    const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
    return (
      <View style={[styles.center, { backgroundColor: t.neutral.bg }]}>
        <FadeSlideIn>
          <View style={styles.doneInner}>
            <ProgressRing value={pct} size={150} strokeWidth={12} />
            <Text variant="headlineSmall" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 20 }}>
              Round complete!
            </Text>
            <Text variant="titleMedium" style={{ color: t.neutral.textMinor, marginTop: 4 }}>
              {score} / {questions.length} correct
            </Text>
            <GradientButton label="Back to deck" onPress={() => router.back()} style={styles.doneBtn} />
          </View>
        </FadeSlideIn>
      </View>
    );
  }

  const imageUrl = resolveImageUrl(current?.image);

  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} hitSlop={8} style={[styles.iconBtn, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}>
          <MaterialIcons name="close" size={22} color={t.neutral.text} />
        </PressableScale>
        <Text variant="labelLarge" style={{ color: t.neutral.textMinor, fontWeight: "700" }}>
          {index + 1} / {questions.length}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <AnimatedBar progress={progress} color={t.palette.primary} trackColor={t.neutral.surface2} style={styles.bar} />
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
      ) : null}
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
  doneInner: { alignItems: "center" },
  doneBtn: { marginTop: 28, minWidth: 220 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  bar: { marginHorizontal: 16 },
  image: { width: "100%", height: 160, marginTop: 12 },
});

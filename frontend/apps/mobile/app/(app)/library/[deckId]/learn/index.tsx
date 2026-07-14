import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, IconButton, Text, useTheme } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { Term } from "@flashlearn/core";
import { LEARNING_TERM_PAGE_SIZE } from "@flashlearn/core";
import { deckApi, learningApi } from "@/api/services";
import { TermCard } from "@/components/TermCard";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { speakText } from "@/utils/audio";

export default function LearnScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const theme = useTheme();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [index, setIndex] = useState(0);
  const [terms, setTerms] = useState<Term[]>([]);

  const deckQuery = useQuery({
    queryKey: queryKeys.decks.detail(deckId!),
    queryFn: async () => unwrap(await deckApi.retrieve(deckId!)),
    enabled: !!deckId,
  });

  const termsQuery = useQuery({
    queryKey: queryKeys.learning.terms(deckId!, page),
    queryFn: async () =>
      unwrap<{ results: Term[] }>(await learningApi.getLearningTerms(deckId!, page)),
    enabled: !!deckId,
  });

  useEffect(() => {
    if (termsQuery.data?.results) {
      setTerms((prev) => (page === 1 ? termsQuery.data!.results : [...prev, ...termsQuery.data!.results]));
    }
  }, [termsQuery.data, page]);

  const current = terms[index];
  const total = (deckQuery.data as { number_of_term?: number })?.number_of_term ?? terms.length;

  const markKnown = useCallback(async (remember: boolean) => {
    if (!current?.learning_progress_id) return;
    if (remember) await learningApi.remember(current.learning_progress_id);
    else await learningApi.incorrect(current.learning_progress_id);
  }, [current]);

  const next = async (remember: boolean) => {
    await markKnown(remember);
    if (index + 1 >= terms.length && terms.length < total) {
      setPage((p) => p + 1);
    }
    if (index + 1 < terms.length || terms.length < total) {
      setIndex((i) => i + 1);
    } else {
      router.back();
    }
  };

  if (deckQuery.isLoading || (termsQuery.isLoading && terms.length === 0)) return <LoadingView />;
  if (deckQuery.isError) return <ErrorView message="Could not load deck" onRetry={() => deckQuery.refetch()} />;
  if (!current) return <LoadingView message="Loading terms…" />;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <IconButton icon="close" onPress={() => router.back()} />
        <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          {index + 1} / {total}
        </Text>
        <IconButton icon="volume-up" onPress={() => speakText(current.name ?? "")} />
      </View>

      <View style={styles.cardWrap}>
        <TermCard name={current.name} meaning={current.meaning} image={current.image} />
      </View>

      <View style={styles.actions}>
        <Button mode="outlined" onPress={() => next(false)} style={styles.btn}>
          Still learning
        </Button>
        <Button mode="contained" onPress={() => next(true)} style={styles.btn}>
          Got it
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  cardWrap: { flex: 1, padding: 16, justifyContent: "center" },
  actions: { flexDirection: "row", gap: 10, padding: 16 },
  btn: { flex: 1 },
});

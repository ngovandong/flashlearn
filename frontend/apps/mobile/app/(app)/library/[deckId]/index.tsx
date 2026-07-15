import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { DeckDetail } from "@flashlearn/core";
import { deckApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";

export default function DeckDetailScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const theme = useTheme();
  const router = useRouter();

  const { data: deck, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.decks.detail(deckId!),
    queryFn: async () => unwrap<DeckDetail>(await deckApi.retrieve(deckId!)),
    enabled: !!deckId,
  });

  if (isLoading) return <LoadingView />;
  if (isError || !deck) return <ErrorView message="Could not load deck" onRetry={() => refetch()} />;

  const total = deck.number_of_term ?? 0;
  const learned = deck.learning_progress?.learned ?? deck.learned ?? 0;
  const pct = total ? Math.round((learned / total) * 100) : 0;
  const canEdit = deck.my_permission === "O" || deck.my_permission === "E";

  return (
    <ScrollView contentContainerStyle={[styles.pad, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineMedium" style={{ color: theme.colors.onBackground }}>
        {deck.name}
      </Text>
      {deck.description ? (
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
          {deck.description}
        </Text>
      ) : null}
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
        {total} terms · {pct}% learned
      </Text>

      <View style={styles.menu}>
        <Button mode="contained" icon="school" onPress={() => router.push(`/library/${deckId}/learn`)} disabled={total === 0}>
          Learn
        </Button>
        <Button mode="contained-tonal" icon="quiz" onPress={() => router.push(`/library/${deckId}/revise`)} disabled={total < 4}>
          Revise
        </Button>
        <Button mode="contained-tonal" icon="sports-esports" onPress={() => router.push(`/library/${deckId}/revise/quick-revise`)} disabled={total < 4}>
          Quick revise game
        </Button>
        <Button mode="contained-tonal" icon="emoji-events" onPress={() => router.push(`/library/${deckId}/competition`)} disabled={total < 4}>
          Competition
        </Button>
        {canEdit ? (
          <Button mode="outlined" icon="edit" onPress={() => router.push(`/library/${deckId}/edit`)}>
            Edit deck
          </Button>
        ) : null}
        {deck.my_permission === "O" ? (
          <Button mode="outlined" icon="group-add" onPress={() => router.push(`/library/${deckId}/share`)}>
            Share
          </Button>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16 },
  menu: { marginTop: 24, gap: 10 },
});

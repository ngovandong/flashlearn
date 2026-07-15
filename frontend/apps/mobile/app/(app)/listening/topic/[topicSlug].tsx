import React from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { ListeningExerciseSummary } from "@flashlearn/core";
import { listeningApi } from "@/api/services";
import { EmptyState } from "@/components/EmptyState";
import { ErrorView } from "@/components/ErrorView";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { NavCard } from "@/components/ui/NavCard";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens } from "@/theme/tokens";

export default function ListeningTopicScreen() {
  const { topicSlug } = useLocalSearchParams<{ topicSlug: string }>();
  const t = useTokens();
  const router = useRouter();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.listening.topic(topicSlug!),
    queryFn: async () =>
      unwrap<{ exercises: ListeningExerciseSummary[]; title?: string }>(
        await listeningApi.getTopic(topicSlug!)
      ),
    enabled: !!topicSlug,
  });

  if (isLoading) return <ScreenSkeleton />;
  if (isError) return <ErrorView message="Could not load topic" onRetry={() => refetch()} />;

  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <FlatList
        data={data?.exercises ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState message="No exercises yet." />}
        renderItem={({ item, index }) => (
          <FadeSlideIn delay={index * 40}>
            <NavCard
              icon="headphones"
              title={item.title}
              subtitle={`${item.sentence_count ?? 0} sentences`}
              onPress={() => router.push(`/listening/exercise/${item.id}`)}
            />
          </FadeSlideIn>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
});

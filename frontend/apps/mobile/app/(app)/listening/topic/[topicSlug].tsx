import React from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { ListeningExerciseSummary } from "@flashlearn/core";
import { listeningApi } from "@/api/services";
import { EmptyState } from "@/components/EmptyState";
import { ErrorView } from "@/components/ErrorView";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { NavCard } from "@/components/ui/NavCard";
import { useFloatingTabBarHeight } from "@/components/ui/FloatingTabBar";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens } from "@/theme/tokens";

const SUCCESS_GREEN = "#22c55e";

interface ExerciseProgress {
  status?: string;
  best_score?: number;
}

export default function ListeningTopicScreen() {
  const { topicSlug } = useLocalSearchParams<{ topicSlug: string }>();
  const t = useTokens();
  const router = useRouter();
  const tabBarHeight = useFloatingTabBarHeight();

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
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState message="No exercises yet." />}
        renderItem={({ item, index }) => {
          const progress = item.progress as ExerciseProgress | undefined;
          const done = progress?.status === "completed";
          const best = progress?.best_score ?? 0;
          const hasAudio = item.has_audio !== false;
          const subtitle = `${item.sentence_count ?? 0} sentences${best > 0 ? ` · best ${best}%` : ""}${
            !hasAudio ? " · audio not collected yet" : ""
          }`;
          return (
            <FadeSlideIn delay={index * 40}>
              <NavCard
                icon={done ? "check-circle" : "headphones"}
                title={item.title}
                subtitle={subtitle}
                disabled={!hasAudio}
                trailing={
                  done ? (
                    <MaterialIcons name="check-circle" size={22} color={SUCCESS_GREEN} />
                  ) : undefined
                }
                onPress={hasAudio ? () => router.push(`/listening/exercise/${item.id}`) : undefined}
              />
            </FadeSlideIn>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
});

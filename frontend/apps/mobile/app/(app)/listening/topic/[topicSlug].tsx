import React from "react";
import { FlatList, View } from "react-native";
import { List, useTheme } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { ListeningExerciseSummary } from "@flashlearn/core";
import { listeningApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";

export default function ListeningTopicScreen() {
  const { topicSlug } = useLocalSearchParams<{ topicSlug: string }>();
  const theme = useTheme();
  const router = useRouter();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.listening.topic(topicSlug!),
    queryFn: async () =>
      unwrap<{ exercises: ListeningExerciseSummary[]; title?: string }>(
        await listeningApi.getTopic(topicSlug!)
      ),
    enabled: !!topicSlug,
  });

  if (isLoading) return <LoadingView />;
  if (isError) return <ErrorView message="Could not load topic" onRetry={() => refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={data?.exercises ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <List.Item
            title={item.title}
            description={`${item.sentence_count ?? 0} sentences`}
            onPress={() => router.push(`/listening/exercise/${item.id}`)}
            right={() => <List.Icon icon="chevron-right" />}
          />
        )}
      />
    </View>
  );
}

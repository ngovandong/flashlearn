import React from "react";
import { FlatList, View } from "react-native";
import { List, SegmentedButtons, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { ListeningTopic } from "@flashlearn/core";
import { listeningApi } from "@/api/services";
import { EmptyState } from "@/components/EmptyState";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";

export default function ListeningScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.listening.topics,
    queryFn: async () => unwrap<ListeningTopic[]>(await listeningApi.getTopics()),
  });

  if (isLoading) return <LoadingView />;
  if (isError) return <ErrorView message="Could not load topics" onRetry={() => refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ padding: 16 }}>
        <SegmentedButtons
          value="test"
          onValueChange={(v) => {
            if (v === "numbers") router.push("/listening/numbers");
          }}
          buttons={[
            { value: "test", label: "Dictation" },
            { value: "numbers", label: "Numbers" },
          ]}
        />
      </View>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.slug}
        ListEmptyComponent={<EmptyState message="No listening topics yet." />}
        renderItem={({ item }) => (
          <List.Item
            title={item.title}
            description={`${item.level ?? ""} · ${item.completed_exercises ?? 0}/${item.total_exercises ?? 0}`}
            onPress={() => router.push(`/listening/topic/${item.slug}`)}
            right={() => <List.Icon icon="chevron-right" />}
          />
        )}
      />
    </View>
  );
}

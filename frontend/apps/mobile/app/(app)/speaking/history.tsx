import React from "react";
import { FlatList, View } from "react-native";
import { List, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { speakingApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { unwrap } from "@/utils/apiError";

export default function SpeakingHistoryScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["speaking", "history"],
    queryFn: async () => unwrap<{ conversations: { id: string; topic?: string; starred?: boolean }[] }>(await speakingApi.getHistory()),
  });

  if (isLoading) return <LoadingView />;
  if (isError) return <ErrorView message="Could not load history" onRetry={() => refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={data?.conversations ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <List.Item
            title={item.topic ?? "Conversation"}
            onPress={() => router.push(`/speaking/${item.id}`)}
            right={() => <List.Icon icon={item.starred ? "star" : "chevron-right"} />}
          />
        )}
      />
    </View>
  );
}

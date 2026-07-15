import React, { useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Appbar, Button, IconButton, List, Text, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { speakingApi } from "@/api/services";
import { EmptyState } from "@/components/EmptyState";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";

interface Conversation {
  id: string;
  topic?: string;
  starred?: boolean;
  created_at?: string;
}

export default function SpeakingHistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.speaking.history,
    queryFn: async () =>
      unwrap<{ conversations: Conversation[] }>(await speakingApi.getHistory()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.speaking.history });

  const starMutation = useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) =>
      speakingApi.setStar(id, starred),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => speakingApi.deleteConversation(id),
    onSuccess: invalidate,
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => speakingApi.bulkDeleteConversations(ids),
    onSuccess: () => {
      setSelected([]);
      setSelectMode(false);
      invalidate();
    },
  });

  // Starred first, then most recent.
  const conversations = useMemo(() => {
    const list = [...(data?.conversations ?? [])];
    return list.sort(
      (a, b) =>
        Number(b.starred) - Number(a.starred) ||
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    );
  }, [data]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  if (isLoading) return <LoadingView />;
  if (isError) return <ErrorView message="Could not load history" onRetry={() => refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header mode="small" style={{ backgroundColor: theme.colors.surface }}>
        {selectMode ? (
          <>
            <Appbar.Action icon="close" onPress={() => { setSelectMode(false); setSelected([]); }} />
            <Appbar.Content title={`${selected.length} selected`} />
            <Appbar.Action
              icon="delete"
              disabled={selected.length === 0 || bulkDeleteMutation.isPending}
              onPress={() => bulkDeleteMutation.mutate(selected)}
            />
          </>
        ) : (
          <>
            <Appbar.BackAction onPress={() => router.back()} />
            <Appbar.Content title="Conversation history" />
            {conversations.length > 0 ? (
              <Appbar.Action icon="checkbox-multiple-marked-outline" onPress={() => setSelectMode(true)} />
            ) : null}
          </>
        )}
      </Appbar.Header>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<EmptyState message="No conversations yet." />}
        renderItem={({ item }) => {
          const isChecked = selected.includes(item.id);
          return (
            <List.Item
              title={item.topic ?? "Conversation"}
              onPress={() =>
                selectMode ? toggleSelect(item.id) : router.push(`/speaking/${item.id}`)
              }
              left={
                selectMode
                  ? () => (
                      <List.Icon icon={isChecked ? "checkbox-marked" : "checkbox-blank-outline"} />
                    )
                  : undefined
              }
              right={() =>
                selectMode ? (
                  <View />
                ) : (
                  <View style={styles.actions}>
                    <IconButton
                      icon={item.starred ? "star" : "star-outline"}
                      iconColor={item.starred ? "#f5a623" : theme.colors.onSurfaceVariant}
                      size={22}
                      onPress={() => starMutation.mutate({ id: item.id, starred: !item.starred })}
                    />
                    <IconButton
                      icon="delete-outline"
                      size={22}
                      onPress={() => deleteMutation.mutate(item.id)}
                    />
                  </View>
                )
              }
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", alignItems: "center" },
});

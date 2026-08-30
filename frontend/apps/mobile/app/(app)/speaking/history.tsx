import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Appbar, Text } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { speakingApi } from "@/api/services";
import { EmptyState } from "@/components/EmptyState";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { AppCard } from "@/components/ui/AppCard";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { useFloatingTabBarHeight } from "@/components/ui/FloatingTabBar";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens } from "@/theme/tokens";

const STAR_GOLD = "#f5a623";

interface Conversation {
  id: string;
  topic?: string;
  starred?: boolean;
  created_at?: string;
}

export default function SpeakingHistoryScreen() {
  const t = useTokens();
  const tabBarHeight = useFloatingTabBarHeight();
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
    <View style={{ flex: 1, backgroundColor: t.neutral.bg }}>
      <Appbar.Header mode="small" style={{ backgroundColor: t.neutral.surface }}>
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
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState message="No conversations yet." />}
        renderItem={({ item, index }) => {
          const isChecked = selected.includes(item.id);
          return (
            <FadeSlideIn delay={index * 30}>
              <AppCard
                onPress={() => (selectMode ? toggleSelect(item.id) : router.push(`/speaking/${item.id}`))}
                padding={14}
              >
                <View style={styles.row}>
                  {selectMode ? (
                    <MaterialIcons
                      name={isChecked ? "check-box" : "check-box-outline-blank"}
                      size={26}
                      color={isChecked ? t.palette.primary : t.neutral.textMuted}
                    />
                  ) : (
                    <FeatureTile icon="forum" size={44} />
                  )}
                  <Text
                    variant="titleMedium"
                    numberOfLines={1}
                    style={{ color: t.neutral.text, fontWeight: "700", flex: 1 }}
                  >
                    {item.topic ?? "Conversation"}
                  </Text>
                  {!selectMode ? (
                    <View style={styles.actions}>
                      <Pressable hitSlop={8} onPress={() => starMutation.mutate({ id: item.id, starred: !item.starred })}>
                        <MaterialIcons
                          name={item.starred ? "star" : "star-outline"}
                          size={22}
                          color={item.starred ? STAR_GOLD : t.neutral.textMuted}
                        />
                      </Pressable>
                      <Pressable hitSlop={8} onPress={() => deleteMutation.mutate(item.id)}>
                        <MaterialIcons name="delete-outline" size={22} color={t.neutral.textMuted} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </AppCard>
            </FadeSlideIn>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  actions: { flexDirection: "row", alignItems: "center", gap: 16 },
});

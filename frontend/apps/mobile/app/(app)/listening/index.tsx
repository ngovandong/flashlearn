import React from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import type { ListeningTopic } from "@flashlearn/core";
import { listeningApi } from "@/api/services";
import { EmptyState } from "@/components/EmptyState";
import { ErrorView } from "@/components/ErrorView";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { NavCard } from "@/components/ui/NavCard";
import { PillTabs } from "@/components/ui/PillTabs";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens } from "@/theme/tokens";

export default function ListeningScreen() {
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.listening.topics,
    queryFn: async () => unwrap<ListeningTopic[]>(await listeningApi.getTopics()),
  });

  if (isLoading) return <ScreenSkeleton showTabs />;
  if (isError) return <ErrorView message="Could not load topics" onRetry={() => refetch()} />;

  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.slug}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <FadeSlideIn style={styles.header}>
            <Text variant="labelLarge" style={{ color: t.palette.primary, fontWeight: "700" }}>
              Train your ear
            </Text>
            <Text variant="headlineMedium" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 2, marginBottom: 14 }}>
              Listening
            </Text>
            <PillTabs
              value="dictation"
              onChange={(v) => {
                if (v === "numbers") router.push("/listening/numbers");
              }}
              options={[
                { value: "dictation", label: "Dictation" },
                { value: "numbers", label: "Numbers" },
              ]}
            />
          </FadeSlideIn>
        }
        ListEmptyComponent={<EmptyState message="No listening topics yet." />}
        renderItem={({ item, index }) => {
          const total = item.total_exercises ?? 0;
          const done = item.completed_exercises ?? 0;
          return (
            <FadeSlideIn delay={index * 50}>
              <NavCard
                icon="headphones"
                title={item.title}
                subtitle={`${item.level ?? ""}${item.level ? " · " : ""}${done}/${total} exercises`}
                progress={total ? done / total : undefined}
                onPress={() => router.push(`/listening/topic/${item.slug}`)}
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
  header: { marginBottom: 14 },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
});

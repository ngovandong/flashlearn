import React, { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { FAB, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Deck, PaginatedResponse } from "@flashlearn/core";
import { deckApi } from "@/api/services";
import { DeckCard } from "@/components/DeckCard";
import { EmptyState } from "@/components/EmptyState";
import { ErrorView } from "@/components/ErrorView";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PillTabs } from "@/components/ui/PillTabs";
import { useFloatingTabBarHeight } from "@/components/ui/FloatingTabBar";
import { unwrap } from "@/utils/apiError";
import { motion, useTokens } from "@/theme/tokens";

type Tab = "mine" | "shared" | "public";

async function fetchPage(tab: Tab, page: number): Promise<PaginatedResponse<Deck>> {
  const res =
    tab === "mine"
      ? await deckApi.getMyOwnDecks(page)
      : tab === "shared"
        ? await deckApi.getOthersDeck(page)
        : await deckApi.getPublicDecks(page);
  return unwrap(res);
}

export default function LibraryScreen() {
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useFloatingTabBarHeight();
  const [tab, setTab] = useState<Tab>("mine");

  const query = useInfiniteQuery({
    queryKey: ["decks", tab],
    queryFn: ({ pageParam = 1 }) => fetchPage(tab, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
  });

  const decks = query.data?.pages.flatMap((p) => p.results ?? []) ?? [];

  if (query.isLoading) return <ScreenSkeleton showTabs rows={6} />;
  if (query.isError) return <ErrorView message="Could not load decks" onRetry={() => query.refetch()} />;

  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text
          variant="headlineMedium"
          style={{ color: t.neutral.text, fontWeight: "800", marginBottom: 14 }}
        >
          Library
        </Text>
        <PillTabs
          value={tab}
          onChange={(v) => setTab(v)}
          options={[
            { value: "mine", label: "Mine" },
            { value: "shared", label: "Shared" },
            { value: "public", label: "Public" },
          ]}
        />
      </View>

      <FlatList
        key={tab}
        data={decks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
        ListEmptyComponent={<EmptyState message="No decks here yet." />}
        renderItem={({ item, index }) => (
          <FadeSlideIn delay={Math.min(index, 6) * motion.stagger.list}>
            <DeckCard deck={item} onPress={() => router.push(`/library/${item.id}`)} />
          </FadeSlideIn>
        )}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <Text style={{ textAlign: "center", color: t.neutral.textMinor, padding: 12 }}>
              Loading more…
            </Text>
          ) : null
        }
      />

      <FAB
        icon="plus"
        color={t.palette.onPrimary}
        style={[
          styles.fab,
          { backgroundColor: t.palette.primary, bottom: tabBarHeight },
          t.shadowStrong,
        ]}
        onPress={() => router.push("/library/create")}
        label="New deck"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  list: { padding: 16, paddingTop: 4, gap: 12, paddingBottom: 110 },
  fab: { position: "absolute", left: 16, bottom: 24, borderRadius: 18 },
});

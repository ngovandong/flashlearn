import React, { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { FAB, SegmentedButtons, Text, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Deck, PaginatedResponse } from "@flashlearn/core";
import { deckApi } from "@/api/services";
import { DeckCard } from "@/components/DeckCard";
import { EmptyState } from "@/components/EmptyState";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";

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
  const theme = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("mine");

  const query = useInfiniteQuery({
    queryKey: ["decks", tab],
    queryFn: ({ pageParam = 1 }) => fetchPage(tab, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
  });

  const decks = query.data?.pages.flatMap((p) => p.results ?? []) ?? [];

  if (query.isLoading) return <LoadingView />;
  if (query.isError) return <ErrorView message="Could not load decks" onRetry={() => query.refetch()} />;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.pad}>
        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          buttons={[
            { value: "mine", label: "Mine" },
            { value: "shared", label: "Shared" },
            { value: "public", label: "Public" },
          ]}
        />
      </View>

      <FlatList
        data={decks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
        ListEmptyComponent={<EmptyState message="No decks here yet." />}
        renderItem={({ item }) => (
          <DeckCard deck={item} onPress={() => router.push(`/library/${item.id}`)} />
        )}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <Text style={{ textAlign: "center", color: theme.colors.onSurfaceVariant, padding: 12 }}>
              Loading more…
            </Text>
          ) : null
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push("/library/create")}
        label="New deck"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: 16, paddingBottom: 8 },
  list: { padding: 16, paddingTop: 0, gap: 10 },
  fab: { position: "absolute", right: 16, bottom: 16 },
});

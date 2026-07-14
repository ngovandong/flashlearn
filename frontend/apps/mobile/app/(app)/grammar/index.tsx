import React, { useState } from "react";
import { FlatList, View } from "react-native";
import { List, Text, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { GrammarUnitSummary } from "@flashlearn/core";
import { grammarApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";

export default function GrammarScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [bookSlug, setBookSlug] = useState<string | undefined>();

  const booksQuery = useQuery({
    queryKey: queryKeys.grammar.books,
    queryFn: async () => unwrap<{ books: { slug: string; title: string }[] }>(await grammarApi.getBooks()),
  });

  const catalogQuery = useQuery({
    queryKey: queryKeys.grammar.catalog(bookSlug),
    queryFn: async () =>
      unwrap<{ sections: { title?: string; units: GrammarUnitSummary[] }[] }>(
        await grammarApi.getCatalog(bookSlug)
      ),
    enabled: booksQuery.isSuccess,
  });

  if (booksQuery.isLoading || catalogQuery.isLoading) return <LoadingView />;
  if (booksQuery.isError || catalogQuery.isError) {
    return <ErrorView message="Could not load grammar" onRetry={() => { booksQuery.refetch(); catalogQuery.refetch(); }} />;
  }

  const units: (GrammarUnitSummary & { section?: string })[] = [];
  for (const section of catalogQuery.data?.sections ?? []) {
    for (const unit of section.units ?? []) {
      units.push({ ...unit, section: section.title });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={units}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={
          <View style={{ padding: 16 }}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Essential Grammar in Use — pick a unit
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <List.Item
            title={`${item.number ?? ""}. ${item.title}`}
            description={`${item.completed_exercises ?? 0}/${item.total_exercises ?? 0} exercises`}
            onPress={() => router.push(`/grammar/${item.key}`)}
            right={() => <List.Icon icon="chevron-right" />}
          />
        )}
      />
    </View>
  );
}

import React, { useEffect, useState } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { Chip, List, Text, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { GrammarUnitSummary } from "@flashlearn/core";
import { grammarApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";

interface GrammarBook {
  slug: string;
  title: string;
}

export default function GrammarScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [bookSlug, setBookSlug] = useState<string | undefined>();

  const booksQuery = useQuery({
    queryKey: queryKeys.grammar.books,
    queryFn: async () => unwrap<{ books: GrammarBook[] }>(await grammarApi.getBooks()),
  });

  const books = booksQuery.data?.books ?? [];

  // Default to the first book so the picker always reflects the loaded catalog.
  useEffect(() => {
    if (!bookSlug && books.length) setBookSlug(books[0].slug);
  }, [books, bookSlug]);

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

  const activeBook = books.find((b) => b.slug === bookSlug);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={units}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={
          <View style={styles.header}>
            {books.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.bookRow}
              >
                {books.map((book) => (
                  <Chip
                    key={book.slug}
                    selected={book.slug === bookSlug}
                    showSelectedCheck={false}
                    onPress={() => setBookSlug(book.slug)}
                    style={styles.bookChip}
                  >
                    {book.title}
                  </Chip>
                ))}
              </ScrollView>
            ) : null}
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: books.length > 1 ? 12 : 0 }}>
              {activeBook?.title ? `${activeBook.title} — pick a unit` : "Pick a unit"}
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

const styles = StyleSheet.create({
  header: { padding: 16 },
  bookRow: { gap: 8, paddingRight: 8 },
  bookChip: { marginRight: 0 },
});

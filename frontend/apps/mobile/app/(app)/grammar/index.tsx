import React, { useEffect, useState } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import type { GrammarUnitSummary } from "@flashlearn/core";
import { grammarApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { NavCard } from "@/components/ui/NavCard";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens } from "@/theme/tokens";

interface GrammarBook {
  slug: string;
  title: string;
}

export default function GrammarScreen() {
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bookSlug, setBookSlug] = useState<string | undefined>();

  const booksQuery = useQuery({
    queryKey: queryKeys.grammar.books,
    queryFn: async () => unwrap<{ books: GrammarBook[] }>(await grammarApi.getBooks()),
  });

  const books = booksQuery.data?.books ?? [];

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

  if (booksQuery.isLoading || catalogQuery.isLoading) return <ScreenSkeleton />;
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
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <FlatList
        data={units}
        keyExtractor={(item) => item.key}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <FadeSlideIn style={styles.header}>
            <Text variant="labelLarge" style={{ color: t.palette.primary, fontWeight: "700" }}>
              Rules & practice
            </Text>
            <Text variant="headlineMedium" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 2 }}>
              Grammar
            </Text>
            {books.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.bookRow}
                style={{ marginTop: 14 }}
              >
                {books.map((book) => {
                  const active = book.slug === bookSlug;
                  return (
                    <PressableScale
                      key={book.slug}
                      onPress={() => setBookSlug(book.slug)}
                      style={[
                        styles.bookChip,
                        {
                          backgroundColor: active ? t.palette.primary : t.neutral.surface2,
                          borderRadius: t.radii.pill,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? t.palette.onPrimary : t.neutral.textMinor,
                          fontWeight: active ? "800" : "600",
                        }}
                      >
                        {book.title}
                      </Text>
                    </PressableScale>
                  );
                })}
              </ScrollView>
            ) : null}
            <Text variant="bodySmall" style={{ color: t.neutral.textMuted, marginTop: 12 }}>
              {activeBook?.title ? `${activeBook.title} — pick a unit` : "Pick a unit"}
            </Text>
          </FadeSlideIn>
        }
        ListEmptyComponent={<EmptyState message="No units yet." />}
        renderItem={({ item, index }) => {
          const total = item.total_exercises ?? 0;
          const done = item.completed_exercises ?? 0;
          return (
            <FadeSlideIn delay={index * 40}>
              <NavCard
                icon="spellcheck"
                title={`${item.number ? `${item.number}. ` : ""}${item.title}`}
                subtitle={`${done}/${total} exercises`}
                progress={total ? done / total : undefined}
                onPress={() => router.push(`/grammar/${item.key}`)}
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
  bookRow: { gap: 8, paddingRight: 8 },
  bookChip: { paddingHorizontal: 16, paddingVertical: 9 },
});

import React, { useEffect, useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import type { GrammarBook, GrammarUnitSummary } from "@flashlearn/core";
import { grammarApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { NavCard } from "@/components/ui/NavCard";
import { useFloatingTabBarHeight } from "@/components/ui/FloatingTabBar";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens } from "@/theme/tokens";

interface GrammarSection {
  id?: string | number;
  title?: string;
  description?: string;
  completed_units?: number;
  total_units?: number;
  units: GrammarUnitSummary[];
}

// Split a book's level string ("A1-A2", "B1") into individual CEFR level codes.
// Mirrors the web GrammarFilters helper so a level chip maps to a single book.
function parseLevels(level?: string): string[] {
  const codes = (level || "").toUpperCase().match(/[ABC][12]/g);
  return codes ? Array.from(new Set(codes)) : [];
}

type Row =
  | { type: "header"; key: string; section: GrammarSection }
  | { type: "unit"; key: string; unit: GrammarUnitSummary };

export default function GrammarScreen() {
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useFloatingTabBarHeight();
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
      unwrap<{ sections: GrammarSection[] }>(await grammarApi.getCatalog(bookSlug)),
    enabled: booksQuery.isSuccess,
  });

  const activeBook = books.find((b) => b.slug === bookSlug);
  const activeLevels = parseLevels(activeBook?.level);

  const levelChips = useMemo(() => {
    const seen = new Set<string>();
    const out: { code: string; slug: string }[] = [];
    books.forEach((book) =>
      parseLevels(book.level).forEach((code) => {
        if (!seen.has(code)) {
          seen.add(code);
          out.push({ code, slug: book.slug });
        }
      })
    );
    out.sort((a, b) => a.code.localeCompare(b.code));
    return out;
  }, [books]);

  if (booksQuery.isLoading || catalogQuery.isLoading) return <ScreenSkeleton />;
  if (booksQuery.isError || catalogQuery.isError) {
    return <ErrorView message="Could not load grammar" onRetry={() => { booksQuery.refetch(); catalogQuery.refetch(); }} />;
  }

  const sections = catalogQuery.data?.sections ?? [];
  const rows: Row[] = [];
  for (const section of sections) {
    rows.push({ type: "header", key: `h-${section.id ?? section.title}`, section });
    for (const unit of section.units ?? []) {
      rows.push({ type: "unit", key: unit.key, unit });
    }
  }

  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 12, paddingBottom: tabBarHeight }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <FadeSlideIn style={styles.header}>
            <Text variant="labelLarge" style={{ color: t.palette.primary, fontWeight: "700" }}>
              Rules & practice
            </Text>
            <Text variant="headlineMedium" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 2 }}>
              Grammar
            </Text>
            {levelChips.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.bookRow}
                style={{ marginTop: 14 }}
              >
                {levelChips.map(({ code, slug }) => {
                  const active = activeLevels.includes(code);
                  return (
                    <PressableScale
                      key={code}
                      onPress={() => setBookSlug(slug)}
                      style={[
                        styles.levelChip,
                        {
                          backgroundColor: active ? t.palette.primary : t.neutral.surface2,
                          borderRadius: t.radii.pill,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? t.palette.onPrimary : t.neutral.textMinor,
                          fontWeight: active ? "800" : "700",
                        }}
                      >
                        {code}
                      </Text>
                    </PressableScale>
                  );
                })}
              </ScrollView>
            ) : null}
            {books.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.bookRow}
                style={{ marginTop: 10 }}
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
                      {book.total_units ? (
                        <Text
                          style={{
                            color: active ? t.palette.onPrimary : t.neutral.textMuted,
                            fontSize: 12,
                            marginTop: 1,
                          }}
                        >
                          {book.completed_units ?? 0}/{book.total_units}
                        </Text>
                      ) : null}
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
        renderItem={({ item: row, index }) => {
          if (row.type === "header") {
            const { section } = row;
            return (
              <FadeSlideIn delay={index * 20} style={styles.sectionHead}>
                <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800" }}>
                  {section.title}
                </Text>
                {section.description ? (
                  <Text variant="bodySmall" style={{ color: t.neutral.textMuted, marginTop: 2 }}>
                    {section.description}
                  </Text>
                ) : null}
                {section.total_units ? (
                  <Text
                    style={{
                      color: t.feature("spellcheck").fg,
                      fontWeight: "700",
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    {section.completed_units ?? 0}/{section.total_units} units
                  </Text>
                ) : null}
              </FadeSlideIn>
            );
          }
          const item = row.unit;
          const total = item.total_exercises ?? 0;
          const done = item.completed_exercises ?? 0;
          return (
            <FadeSlideIn delay={index * 20}>
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
  levelChip: { paddingHorizontal: 14, paddingVertical: 7, minWidth: 44, alignItems: "center" },
  sectionHead: { marginTop: 4, marginBottom: -2 },
});

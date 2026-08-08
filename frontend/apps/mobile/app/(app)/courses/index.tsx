import React, { useState } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { CourseSummary, PaginatedResponse } from "@flashlearn/core";
import { courseApi } from "@/api/services";
import { EmptyState } from "@/components/EmptyState";
import { ErrorView } from "@/components/ErrorView";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { NavCard } from "@/components/ui/NavCard";
import { useFloatingTabBarHeight } from "@/components/ui/FloatingTabBar";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens } from "@/theme/tokens";

export default function CoursesScreen() {
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useFloatingTabBarHeight();
  const [level, setLevel] = useState("");

  const levelsQuery = useQuery({
    queryKey: queryKeys.courses.levels,
    queryFn: async () => unwrap<{ levels?: string[] } | string[]>(await courseApi.getLevels()),
  });
  const levels = Array.isArray(levelsQuery.data) ? levelsQuery.data : levelsQuery.data?.levels ?? [];

  const query = useInfiniteQuery({
    queryKey: ["courses", "catalog", level],
    queryFn: async ({ pageParam = 1 }) =>
      unwrap<PaginatedResponse<CourseSummary>>(await courseApi.getCatalog(pageParam, level)),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
  });

  if (query.isLoading) return <ScreenSkeleton />;
  if (query.isError) return <ErrorView message="Could not load courses" onRetry={() => query.refetch()} />;

  const courses = query.data?.pages.flatMap((p) => p.results ?? []) ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <FlatList
        data={courses}
        keyExtractor={(item) => item.slug}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 12, paddingBottom: tabBarHeight }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <FadeSlideIn style={styles.header}>
            <Text variant="labelLarge" style={{ color: t.palette.primary, fontWeight: "700" }}>
              Guided learning
            </Text>
            <Text variant="headlineMedium" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 2 }}>
              Courses
            </Text>
            {levels.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.levelRow}
                style={{ marginTop: 14 }}
              >
                {["", ...levels].map((lvl) => {
                  const active = lvl === level;
                  return (
                    <PressableScale
                      key={lvl || "all"}
                      onPress={() => setLevel(lvl)}
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
                          fontWeight: active ? "800" : "600",
                        }}
                      >
                        {lvl || "All levels"}
                      </Text>
                    </PressableScale>
                  );
                })}
              </ScrollView>
            ) : null}
          </FadeSlideIn>
        }
        ListEmptyComponent={
          <EmptyState message={level ? `No ${level} courses found.` : "No courses available."} />
        }
        renderItem={({ item, index }) => {
          const total = item.total_lessons ?? 0;
          const passed = item.passed_lessons ?? 0;
          return (
            <FadeSlideIn delay={index * 50}>
              <NavCard
                icon="menu-book"
                title={item.title}
                subtitle={`${item.level ?? ""}${item.level ? " · " : ""}${passed}/${total} lessons`}
                progress={total ? passed / total : undefined}
                onPress={() => router.push(`/courses/${item.slug}`)}
              />
            </FadeSlideIn>
          );
        }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { marginBottom: 14 },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
  levelRow: { gap: 8, paddingRight: 8 },
  levelChip: { paddingHorizontal: 16, paddingVertical: 9 },
});

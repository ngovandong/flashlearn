import React from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import type { CourseSummary, PaginatedResponse } from "@flashlearn/core";
import { courseApi } from "@/api/services";
import { EmptyState } from "@/components/EmptyState";
import { ErrorView } from "@/components/ErrorView";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { NavCard } from "@/components/ui/NavCard";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens } from "@/theme/tokens";

export default function CoursesScreen() {
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.courses.catalog(1, ""),
    queryFn: async () => unwrap<PaginatedResponse<CourseSummary>>(await courseApi.getCatalog(1)),
  });

  if (isLoading) return <ScreenSkeleton />;
  if (isError) return <ErrorView message="Could not load courses" onRetry={() => refetch()} />;

  const courses = data?.results ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <FlatList
        data={courses}
        keyExtractor={(item) => item.slug}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <FadeSlideIn style={styles.header}>
            <Text variant="labelLarge" style={{ color: t.palette.primary, fontWeight: "700" }}>
              Guided learning
            </Text>
            <Text variant="headlineMedium" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 2 }}>
              Courses
            </Text>
          </FadeSlideIn>
        }
        ListEmptyComponent={<EmptyState message="No courses available." />}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { marginBottom: 14 },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
});

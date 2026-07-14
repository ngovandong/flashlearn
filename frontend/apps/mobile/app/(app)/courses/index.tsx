import React from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { List, Text, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { CourseSummary, PaginatedResponse } from "@flashlearn/core";
import { courseApi } from "@/api/services";
import { EmptyState } from "@/components/EmptyState";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";

export default function CoursesScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.courses.catalog(1, ""),
    queryFn: async () => unwrap<PaginatedResponse<CourseSummary>>(await courseApi.getCatalog(1)),
  });

  if (isLoading) return <LoadingView />;
  if (isError) return <ErrorView message="Could not load courses" onRetry={() => refetch()} />;

  const courses = data?.results ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={courses}
        keyExtractor={(item) => item.slug}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState message="No courses available." />}
        renderItem={({ item }) => (
          <List.Item
            title={item.title}
            description={`${item.level} · ${item.passed_lessons ?? 0}/${item.total_lessons ?? 0} lessons`}
            onPress={() => router.push(`/courses/${item.slug}`)}
            right={() => <List.Icon icon="chevron-right" />}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingVertical: 8 },
});

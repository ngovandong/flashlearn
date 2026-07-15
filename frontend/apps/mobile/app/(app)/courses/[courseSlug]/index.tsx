import React from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { List, Text, useTheme } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { CourseDetail, CourseLesson } from "@flashlearn/core";
import { courseApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";

export default function CourseDetailScreen() {
  const { courseSlug } = useLocalSearchParams<{ courseSlug: string }>();
  const theme = useTheme();
  const router = useRouter();

  const { data: course, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.courses.detail(courseSlug!),
    queryFn: async () => unwrap<CourseDetail>(await courseApi.getCourse(courseSlug!)),
    enabled: !!courseSlug,
  });

  if (isLoading) return <LoadingView />;
  if (isError || !course) return <ErrorView message="Could not load course" onRetry={() => refetch()} />;

  const lessons: (CourseLesson & { sectionTitle?: string })[] = [];
  for (const section of course.sections ?? []) {
    for (const lesson of section.lessons ?? []) {
      lessons.push({ ...lesson, sectionTitle: section.title });
    }
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
          {course.title}
        </Text>
        {course.description ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
            {course.description}
          </Text>
        ) : null}
      </View>
      <FlatList
        data={lessons}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <List.Item
            title={item.title}
            description={item.sectionTitle}
            onPress={() => router.push(`/courses/${courseSlug}/${item.id}`)}
            right={() => <List.Icon icon={item.passed ? "check-circle" : "chevron-right"} />}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { padding: 16 },
});

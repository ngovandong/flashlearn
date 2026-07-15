import React from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { CourseDetail, CourseLesson } from "@flashlearn/core";
import { courseApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { NavCard } from "@/components/ui/NavCard";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens } from "@/theme/tokens";

const SUCCESS_GREEN = "#22c55e";

export default function CourseDetailScreen() {
  const { courseSlug } = useLocalSearchParams<{ courseSlug: string }>();
  const t = useTokens();
  const router = useRouter();

  const { data: course, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.courses.detail(courseSlug!),
    queryFn: async () => unwrap<CourseDetail>(await courseApi.getCourse(courseSlug!)),
    enabled: !!courseSlug,
  });

  if (isLoading) return <ScreenSkeleton />;
  if (isError || !course) return <ErrorView message="Could not load course" onRetry={() => refetch()} />;

  const lessons: (CourseLesson & { sectionTitle?: string })[] = [];
  for (const section of course.sections ?? []) {
    for (const lesson of section.lessons ?? []) {
      lessons.push({ ...lesson, sectionTitle: section.title });
    }
  }

  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <FlatList
        data={lessons}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <FadeSlideIn style={styles.header}>
            <Text variant="headlineSmall" style={{ color: t.neutral.text, fontWeight: "800" }}>
              {course.title}
            </Text>
            {course.description ? (
              <Text variant="bodyMedium" style={{ color: t.neutral.textMinor, marginTop: 6 }}>
                {course.description}
              </Text>
            ) : null}
          </FadeSlideIn>
        }
        renderItem={({ item, index }) => (
          <FadeSlideIn delay={index * 40}>
            <NavCard
              icon="record-voice-over"
              title={item.title}
              subtitle={item.sectionTitle}
              onPress={() => router.push(`/courses/${courseSlug}/${item.id}`)}
              trailing={
                item.passed ? (
                  <MaterialIcons name="check-circle" size={24} color={SUCCESS_GREEN} />
                ) : undefined
              }
            />
          </FadeSlideIn>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { marginBottom: 14 },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
});

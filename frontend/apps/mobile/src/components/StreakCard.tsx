import React from "react";
import { View, StyleSheet } from "react-native";
import { Card, Text, useTheme } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useLearningStreak } from "@/features/home/hooks";

export function StreakCard() {
  const theme = useTheme();
  const { data, isLoading } = useLearningStreak();
  const streak = data?.streak ?? 0;
  const studiedToday = data?.studied_today ?? false;

  return (
    <Card mode="contained" style={{ backgroundColor: theme.colors.surfaceVariant }}>
      <Card.Content style={styles.row}>
        <View
          style={[styles.iconWrap, { backgroundColor: theme.colors.primary }]}
        >
          <MaterialIcons name="local-fire-department" size={26} color={theme.colors.onPrimary} />
        </View>
        <View style={styles.text}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
            {isLoading ? "…" : `${streak}-day streak`}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {studiedToday
              ? "You've studied today — keep it going!"
              : "Study something today to extend your streak."}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1 },
});

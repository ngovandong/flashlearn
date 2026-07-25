import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useLearningStreak } from "@/features/home/hooks";
import { GradientSurface } from "@/components/ui/GradientSurface";
import { useTokens } from "@/theme/tokens";

export function StreakCard() {
  const t = useTokens();
  const { data, isLoading } = useLearningStreak();
  const streak = data?.streak ?? 0;
  const studiedToday = data?.studied_today ?? false;

  return (
    <GradientSurface
      style={[styles.card, { borderRadius: t.radii.lg }, t.shadowStrong]}
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <MaterialIcons name="local-fire-department" size={28} color="#ffffff" />
        </View>
        <View style={styles.text}>
          <Text variant="headlineSmall" style={styles.streak}>
            {isLoading ? "…" : `${streak}-day streak`}
          </Text>
          <Text variant="bodyMedium" style={styles.sub}>
            {studiedToday
              ? "You've studied today — keep it going!"
              : "Study something today to extend your streak."}
          </Text>
        </View>
      </View>
    </GradientSurface>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  text: { flex: 1 },
  streak: { color: "#ffffff", fontWeight: "800" },
  sub: { color: "rgba(255, 255, 255, 0.9)", marginTop: 2 },
});

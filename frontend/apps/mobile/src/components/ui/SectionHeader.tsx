import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { PressableScale } from "@/components/PressableScale";
import { useTokens } from "@/theme/tokens";

interface Props {
  title: string;
  subtitle?: string;
  /** Optional trailing action link (e.g. "See all"). */
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, subtitle, action, onAction }: Props) {
  const t = useTokens();
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800" }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySmall" style={{ color: t.neutral.textMinor, marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? (
        <PressableScale onPress={onAction} hitSlop={8} activeScale={0.92}>
          <Text style={{ color: t.palette.primary, fontWeight: "700" }}>{action}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  flex: { flex: 1 },
});

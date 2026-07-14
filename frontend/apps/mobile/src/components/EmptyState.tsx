import React from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface Props {
  message: string;
}

export function EmptyState({ message }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
});

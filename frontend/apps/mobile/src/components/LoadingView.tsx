import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface Props {
  message?: string;
}

export function LoadingView({ message }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      {message ? (
        <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
});

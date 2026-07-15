import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorView({ message, onRetry }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <Text variant="bodyLarge" style={{ color: theme.colors.error, textAlign: "center" }}>
        {message}
      </Text>
      {onRetry ? (
        <Button mode="contained" onPress={onRetry} style={{ marginTop: 16 }}>
          Retry
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
});

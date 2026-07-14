import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { resolveImageUrl } from "@flashlearn/core";

interface Props {
  name?: string;
  meaning?: string;
  image?: string;
  compact?: boolean;
}

export function TermCard({ name, meaning, image, compact }: Props) {
  const theme = useTheme();
  const url = resolveImageUrl(image);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
      {url ? (
        <Image source={{ uri: url }} style={compact ? styles.imageSmall : styles.image} resizeMode="cover" />
      ) : null}
      <View style={styles.body}>
        {name ? (
          <Text variant={compact ? "titleMedium" : "headlineSmall"} style={{ color: theme.colors.onSurface }}>
            {name}
          </Text>
        ) : null}
        {meaning ? (
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
            {meaning}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 120,
  },
  image: { width: "100%", height: 180 },
  imageSmall: { width: "100%", height: 120 },
  body: { padding: 16 },
});

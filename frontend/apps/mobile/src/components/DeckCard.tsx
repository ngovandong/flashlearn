import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Card, Text, useTheme } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import type { Deck } from "@flashlearn/core";

interface Props {
  deck: Deck;
  onPress: () => void;
}

export function DeckCard({ deck, onPress }: Props) {
  const theme = useTheme();
  const learned = deck.learned ?? 0;
  const total = deck.number_of_term ?? 0;
  const pct = total ? Math.round((learned / total) * 100) : 0;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
      <Card mode="outlined" style={{ backgroundColor: theme.colors.surface }}>
        <Card.Content style={styles.row}>
          <View style={[styles.icon, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialIcons name="style" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.body}>
            <Text variant="titleMedium" numberOfLines={1} style={{ color: theme.colors.onSurface }}>
              {deck.name}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {total} terms · {pct}% learned
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
        </Card.Content>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
});

import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Modal, Portal, Text, useTheme } from "react-native-paper";

export interface LeaderboardData {
  entries: { player: { id: string; name: string }; score: number }[];
  my_score: number | null;
  my_rank: number | null;
}

interface Props {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  data: LeaderboardData | null;
  loading: boolean;
}

export function Leaderboard({ visible, onDismiss, title, data, loading }: Props) {
  const theme = useTheme();
  const entries = data?.entries ?? [];
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
      >
        <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
          🏆 {title}
        </Text>
        {loading ? (
          <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>Loading…</Text>
        ) : entries.length === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
            No scores yet — set the first record!
          </Text>
        ) : (
          <ScrollView style={styles.list}>
            {entries.map((entry, i) => (
              <View key={`${entry.player.id}-${i}`} style={styles.row}>
                <Text style={{ color: theme.colors.onSurfaceVariant, width: 28 }}>{i + 1}</Text>
                <Text style={{ color: theme.colors.onSurface, flex: 1 }} numberOfLines={1}>
                  {entry.player.name}
                </Text>
                <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>{entry.score}</Text>
              </View>
            ))}
          </ScrollView>
        )}
        {data?.my_rank ? (
          <Text style={{ color: theme.colors.primary, textAlign: "center", marginTop: 8 }}>
            You are #{data.my_rank} with {data.my_score} points
          </Text>
        ) : null}
        <Button mode="contained" onPress={onDismiss} style={{ marginTop: 16 }}>
          Close
        </Button>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: { margin: 24, padding: 24, borderRadius: 16, maxHeight: "80%" },
  empty: { textAlign: "center", marginVertical: 20 },
  list: { marginTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
});

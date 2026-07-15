import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Modal, Portal, Text, useTheme } from "react-native-paper";
import { Celebration } from "./Celebration";

interface Props {
  visible: boolean;
  score: number;
  best: number;
  isNewBest: boolean;
  rank: number | null;
  onPlayAgain: () => void;
  onLeaderboard: () => void;
  onExit: () => void;
}

export function GameOver({
  visible,
  score,
  best,
  isNewBest,
  rank,
  onPlayAgain,
  onLeaderboard,
  onExit,
}: Props) {
  const theme = useTheme();
  return (
    <Portal>
      {visible && isNewBest ? <Celebration /> : null}
      <Modal
        visible={visible}
        onDismiss={onExit}
        contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
      >
        <Text variant="titleLarge" style={{ color: theme.colors.onSurface, textAlign: "center" }}>
          {isNewBest ? "Record broken!" : "Game over"}
        </Text>
        <Text style={[styles.score, { color: theme.colors.primary }]}>{score}</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
          {isNewBest ? "You beat your previous best." : `Your best is ${best}.`}
          {rank ? ` Ranked #${rank}.` : ""}
        </Text>
        <Button mode="contained" onPress={onPlayAgain} style={styles.btn} icon="replay">
          Play again
        </Button>
        <Button mode="contained-tonal" onPress={onLeaderboard} style={styles.btn} icon="trophy">
          Leaderboard
        </Button>
        <Button mode="text" onPress={onExit} style={styles.btn}>
          Exit
        </Button>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: { margin: 24, padding: 24, borderRadius: 16 },
  score: { fontSize: 48, fontWeight: "900", textAlign: "center", marginVertical: 8 },
  btn: { marginTop: 10 },
});

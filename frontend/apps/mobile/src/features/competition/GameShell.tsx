import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";
import type { GameSound } from "./useGameSound";

const AnimatedText = Animated.createAnimatedComponent(Text);

interface Props {
  score: number;
  best: number;
  sound: GameSound;
  onLeaderboard: () => void;
  children: React.ReactNode;
}

// Top bar shared by every game: live score, personal best, leaderboard + mute.
export function GameShell({ score, best, sound, onLeaderboard, children }: Props) {
  const theme = useTheme();
  const bump = useRef(new Animated.Value(1)).current;
  const prev = useRef(score);

  useEffect(() => {
    if (score > prev.current) {
      Animated.sequence([
        Animated.timing(bump, { toValue: 1.4, duration: 120, useNativeDriver: true }),
        Animated.spring(bump, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    }
    prev.current = score;
  }, [score, bump]);

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.bar}>
        <AnimatedText
          variant="titleLarge"
          style={{ color: theme.colors.primary, fontWeight: "800", transform: [{ scale: bump }] }}
        >
          {score}
        </AnimatedText>
        <View style={styles.right}>
          {best > 0 ? (
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              🏆 {best}
            </Text>
          ) : null}
          <IconButton icon="trophy-outline" size={22} onPress={onLeaderboard} />
          <IconButton
            icon={sound.muted ? "volume-off" : "volume-high"}
            size={22}
            onPress={sound.toggleMute}
          />
        </View>
      </View>
      <View style={styles.stage}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  right: { flexDirection: "row", alignItems: "center", gap: 4 },
  stage: { flex: 1 },
});

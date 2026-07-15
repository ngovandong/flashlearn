import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import {
  applyAnswer,
  buildMcqQuestions,
  initialComboState,
  shuffleArray,
} from "@flashlearn/core";
import type { GameProps } from "../types";

const LIVES = 3;
const COLUMNS = ["6%", "31%", "54%", "78%"];
const EGG_H = 64;

function roundDuration(round: number) {
  return Math.max(2600, 5600 - round * 260);
}

export default function BlasterGame({ pool, sound, onScore, onGameOver }: GameProps) {
  const theme = useTheme();
  const deck = useMemo(() => buildMcqQuestions(pool.terms), [pool]);
  const [round, setRound] = useState(0);
  const [combo, setCombo] = useState(initialComboState);
  const [lives, setLives] = useState(LIVES);
  const [skyH, setSkyH] = useState(0);
  const fall = useRef(new Animated.Value(0)).current;
  const lock = useRef(false);
  const livesRef = useRef(LIVES);
  const comboRef = useRef(initialComboState());

  const question = deck[round % (deck.length || 1)];
  const eggs = useMemo(() => {
    if (!question) return [];
    const cols = shuffleArray([...COLUMNS]);
    return question.options.slice(0, 4).map((word, i) => ({
      word,
      isTarget: word === question.answer,
      left: cols[i],
    }));
  }, [question]);

  useEffect(() => onScore(combo.score), [combo.score, onScore]);

  useEffect(() => {
    if (!question || skyH === 0) return undefined;
    lock.current = false;
    fall.setValue(0);
    const anim = Animated.timing(fall, {
      toValue: 1,
      duration: roundDuration(round),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished && !lock.current) endRound(false);
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, question, skyH]);

  const endRound = (hit: boolean) => {
    if (lock.current) return;
    lock.current = true;
    const nextCombo = applyAnswer(comboRef.current, hit);
    comboRef.current = nextCombo;
    setCombo(nextCombo);
    if (hit) {
      setTimeout(() => setRound((r) => r + 1), 420);
      return;
    }
    livesRef.current -= 1;
    setLives(livesRef.current);
    if (livesRef.current <= 0) {
      onGameOver(nextCombo.score);
    } else {
      setTimeout(() => setRound((r) => r + 1), 500);
    }
  };

  const shoot = (egg: { word: string; isTarget: boolean }) => {
    if (lock.current) return;
    if (egg.isTarget) {
      sound.say(egg.word);
      endRound(true);
    } else {
      endRound(false);
    }
  };

  const translateY = fall.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, skyH - EGG_H)],
  });

  return (
    <View style={styles.wrap}>
      <Text style={{ alignSelf: "flex-end", fontSize: 16 }}>
        {"❤️".repeat(lives)}
        {"🤍".repeat(Math.max(0, LIVES - lives))}
      </Text>
      <View
        style={[styles.sky, { backgroundColor: theme.colors.surfaceVariant }]}
        onLayout={(e) => setSkyH(e.nativeEvent.layout.height)}
      >
        {eggs.map((egg) => (
          <Animated.View
            key={egg.word}
            style={[styles.egg, { left: egg.left as any, transform: [{ translateY }] }]}
          >
            <Pressable onPress={() => shoot(egg)} style={styles.eggBtn}>
              <Text style={styles.eggShell}>🥚</Text>
              <Text style={[styles.eggWord, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface }]} numberOfLines={1}>
                {egg.word}
              </Text>
            </Pressable>
          </Animated.View>
        ))}
        <View style={[styles.ground, { backgroundColor: theme.colors.primary }]} />
      </View>
      <View style={styles.target}>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>Shoot the word for:</Text>
        <Text variant="titleLarge" style={{ color: theme.colors.onSurface, textAlign: "center" }}>
          {question?.prompt}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 10 },
  sky: { flex: 1, borderRadius: 12, overflow: "hidden" },
  egg: { position: "absolute", top: 0, width: 84, alignItems: "center" },
  eggBtn: { alignItems: "center" },
  eggShell: { fontSize: 30 },
  eggWord: {
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
  },
  ground: { position: "absolute", bottom: 0, left: 0, right: 0, height: 8 },
  target: { alignItems: "center", gap: 2 },
});

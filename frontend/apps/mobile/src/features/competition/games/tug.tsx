import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import {
  applyAnswer,
  buildSynAntQuestions,
  initialComboState,
  simulateBotAnswer,
} from "@flashlearn/core";
import type { GameProps } from "../types";
import { OptionButtons } from "./OptionButtons";

const PULL = 0.13;
const BOT_PULL = 0.09;
const FEEDBACK_MS = 650;

export default function TugGame({ pool, sound, onScore, onGameOver }: GameProps) {
  const theme = useTheme();
  const deck = useMemo(() => buildSynAntQuestions(pool.terms), [pool]);
  const [index, setIndex] = useState(0);
  const [combo, setCombo] = useState(initialComboState);
  const [picked, setPicked] = useState<"Synonym" | "Antonym" | null>(null);
  const [railW, setRailW] = useState(0);
  const rope = useRef(0.5);
  const knot = useRef(new Animated.Value(0.5)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ended = useRef(false);

  const question = deck[index % (deck.length || 1)];

  useEffect(() => onScore(combo.score), [combo.score, onScore]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const settle = (correct: boolean) => {
    if (ended.current) return;
    if (rope.current >= 1) {
      ended.current = true;
      setCombo((c) => {
        onGameOver(c.score + 60);
        return c;
      });
      return;
    }
    if (rope.current <= 0) {
      ended.current = true;
      setCombo((c) => {
        onGameOver(c.score);
        return c;
      });
      return;
    }
    timer.current = setTimeout(() => {
      setIndex((i) => i + 1);
      setPicked(null);
    }, FEEDBACK_MS);
  };

  const answer = (choiceIsSynonym: boolean) => {
    if (picked || !question || ended.current) return;
    const correct = choiceIsSynonym === question.isSynonym;
    setPicked(choiceIsSynonym ? "Synonym" : "Antonym");
    const bot = simulateBotAnswer("medium");
    let delta = correct ? PULL : -PULL;
    if (bot.correct) delta -= BOT_PULL;
    if (correct) sound.say(question.word);
    setCombo((c) => applyAnswer(c, correct));
    rope.current = Math.min(1, Math.max(0, rope.current + delta));
    Animated.timing(knot, {
      toValue: rope.current,
      duration: 400,
      useNativeDriver: true,
    }).start();
    settle(correct);
  };

  const answerVal = question ? (question.isSynonym ? "Synonym" : "Antonym") : "";

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <Text style={styles.side}>🤖</Text>
        <View
          style={[styles.rail, { backgroundColor: theme.colors.surfaceVariant }]}
          onLayout={(e) => setRailW(e.nativeEvent.layout.width - 30)}
        >
          <Animated.Text
            style={[
              styles.knot,
              { transform: [{ translateX: Animated.multiply(knot, railW) }] },
            ]}
          >
            🪢
          </Animated.Text>
        </View>
        <Text style={styles.side}>🧑</Text>
      </View>

      {question ? (
        <View style={styles.quiz}>
          <View style={styles.prompt}>
            <Text variant="titleLarge" style={{ color: theme.colors.primary, fontWeight: "800" }}>
              {question.word}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>vs</Text>
            <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
              {question.candidate}
            </Text>
          </View>
          <OptionButtons
            options={["Synonym", "Antonym"]}
            answer={answerVal}
            picked={picked}
            onPick={(opt) => answer(opt === "Synonym")}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 28 },
  bar: { flexDirection: "row", alignItems: "center", gap: 8 },
  side: { fontSize: 26 },
  rail: { flex: 1, height: 12, borderRadius: 6, justifyContent: "center" },
  knot: { position: "absolute", fontSize: 22 },
  quiz: { gap: 16 },
  prompt: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 12, flexWrap: "wrap" },
});

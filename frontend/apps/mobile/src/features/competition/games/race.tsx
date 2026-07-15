import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import {
  applyAnswer,
  buildMcqQuestions,
  initialComboState,
  simulateBotAnswer,
} from "@flashlearn/core";
import type { GameProps } from "../types";
import { OptionButtons } from "./OptionButtons";

const TOTAL = 12;
const BOTS = [
  { name: "Turbo", difficulty: "hard" as const, emoji: "🏎️" },
  { name: "Zoom", difficulty: "medium" as const, emoji: "🚙" },
  { name: "Putt", difficulty: "easy" as const, emoji: "🚗" },
];
const FEEDBACK_MS = 700;
const CAR_W = 30;

export default function RaceGame({ pool, sound, onScore, onGameOver }: GameProps) {
  const theme = useTheme();
  const questions = useMemo(() => buildMcqQuestions(pool.terms, TOTAL), [pool]);
  const total = questions.length || TOTAL;
  const [index, setIndex] = useState(0);
  const [combo, setCombo] = useState(initialComboState);
  const [picked, setPicked] = useState<string | null>(null);
  const [trackW, setTrackW] = useState(0);

  const player = useRef(0);
  const bots = useRef(BOTS.map(() => 0));
  const anims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const question = questions[index];

  useEffect(() => onScore(combo.score), [combo.score, onScore]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const moveTo = (laneIdx: number, progress: number) => {
    const max = Math.max(0, trackW - CAR_W);
    Animated.timing(anims[laneIdx], {
      toValue: progress * max,
      duration: 450,
      useNativeDriver: true,
    }).start();
  };

  const answer = (option: string) => {
    if (picked || !question) return;
    const correct = option === question.answer;
    setPicked(option);
    if (correct) {
      sound.say(question.answer);
      setCombo((c) => applyAnswer(c, true));
      player.current += 1;
      moveTo(0, player.current / total);
    } else {
      setCombo((c) => applyAnswer(c, false));
    }
    bots.current = bots.current.map((pos, i) => {
      const next = simulateBotAnswer(BOTS[i].difficulty).correct ? pos + 1 : pos;
      moveTo(i + 1, next / total);
      return next;
    });

    timer.current = setTimeout(() => {
      const next = index + 1;
      if (next >= total) {
        const ahead = bots.current.filter((b) => b > player.current).length;
        const bonus = Math.max(0, (BOTS.length + 1 - (ahead + 1)) * 25);
        setCombo((c) => {
          onGameOver(c.score + bonus);
          return c;
        });
      } else {
        setIndex(next);
        setPicked(null);
      }
    }, FEEDBACK_MS);
  };

  const lanes = [
    { name: "You", emoji: "🏁", me: true },
    ...BOTS.map((b) => ({ name: b.name, emoji: b.emoji, me: false })),
  ];

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.track, { backgroundColor: theme.colors.surfaceVariant }]}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width - 16)}
      >
        {lanes.map((lane, i) => (
          <View key={i} style={styles.lane}>
            <Text style={[styles.laneLabel, { color: lane.me ? theme.colors.primary : theme.colors.onSurfaceVariant }]}>
              {lane.name}
            </Text>
            <View style={styles.road}>
              <Animated.Text style={[styles.car, { transform: [{ translateX: anims[i] }] }]}>
                {lane.emoji}
              </Animated.Text>
            </View>
          </View>
        ))}
      </View>

      {question ? (
        <View style={styles.quiz}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface, textAlign: "center" }}>
            {question.prompt}
          </Text>
          <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
            {index + 1} / {total}
          </Text>
          <OptionButtons
            options={question.options}
            answer={question.answer}
            picked={picked}
            onPick={answer}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 16 },
  track: { borderRadius: 12, padding: 8, gap: 6 },
  lane: { flexDirection: "row", alignItems: "center", gap: 8 },
  laneLabel: { width: 44, fontSize: 11, fontWeight: "700" },
  road: { flex: 1, height: 24, borderBottomWidth: 1, borderStyle: "dashed", borderColor: "rgba(128,128,128,0.5)" },
  car: { position: "absolute", bottom: 0, fontSize: 20 },
  quiz: { gap: 12 },
});

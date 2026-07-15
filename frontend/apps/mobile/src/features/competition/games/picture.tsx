import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import {
  applyAnswer,
  buildImageQuestions,
  initialComboState,
  timeBonus,
} from "@flashlearn/core";
import type { GameProps } from "../types";

const ROUNDS = 10;
const LIMIT_MS = 6000;
const FEEDBACK_MS = 750;

export default function PictureGame({ pool, sound, onScore, onGameOver }: GameProps) {
  const theme = useTheme();
  const deck = useMemo(() => buildImageQuestions(pool.terms), [pool]);
  const total = Math.min(ROUNDS, deck.length) || deck.length;
  const [index, setIndex] = useState(0);
  const [combo, setCombo] = useState(initialComboState);
  const [picked, setPicked] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(LIMIT_MS);
  const start = useRef(Date.now());
  const interval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const feedback = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const question = deck[index % (deck.length || 1)];

  useEffect(() => onScore(combo.score), [combo.score, onScore]);

  useEffect(() => {
    if (!question) return undefined;
    setPicked(null);
    setRemaining(LIMIT_MS);
    start.current = Date.now();
    sound.say(question.prompt);
    interval.current = setInterval(() => {
      const left = Math.max(0, LIMIT_MS - (Date.now() - start.current));
      setRemaining(left);
      if (left <= 0) resolve(null);
    }, 100);
    return () => {
      clearInterval(interval.current);
      clearTimeout(feedback.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, question]);

  const resolve = (name: string | null) => {
    if (picked) return;
    clearInterval(interval.current);
    const correct = !!name && name === question.answer;
    setPicked(name ?? "__timeout__");
    if (correct) {
      setCombo((c) => {
        const nextState = applyAnswer(c, true);
        return { ...nextState, score: nextState.score + timeBonus(remaining, LIMIT_MS) };
      });
    } else {
      setCombo((c) => applyAnswer(c, false));
    }
    feedback.current = setTimeout(() => {
      const n = index + 1;
      if (n >= total) {
        setCombo((c) => {
          onGameOver(c.score);
          return c;
        });
      } else {
        setIndex(n);
      }
    }, FEEDBACK_MS);
  };

  const pct = (remaining / LIMIT_MS) * 100;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>
          {Math.min(index + 1, total)} / {total}
        </Text>
        <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, fontWeight: "800" }}>
          {question?.prompt}
        </Text>
        {question?.hint ? (
          <Text style={{ color: theme.colors.onSurfaceVariant }}>{question.hint}</Text>
        ) : null}
      </View>
      <View style={[styles.timer, { backgroundColor: theme.colors.surfaceVariant }]}>
        <View
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: pct < 30 ? theme.colors.error : theme.colors.primary,
          }}
        />
      </View>
      {question ? (
        <View style={styles.grid}>
          {question.options.map((opt) => {
            let border = "transparent";
            if (picked) {
              if (opt.name === question.answer) border = "#2e7d32";
              else if (opt.name === picked) border = theme.colors.error;
            }
            return (
              <Pressable
                key={opt.name}
                style={[styles.tile, { borderColor: border }]}
                disabled={!!picked}
                onPress={() => resolve(opt.name)}
              >
                <Image source={{ uri: opt.image }} style={styles.img} resizeMode="cover" />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12 },
  head: { alignItems: "center", gap: 2 },
  timer: { height: 8, borderRadius: 4, overflow: "hidden" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
  tile: { width: "48%", aspectRatio: 4 / 3, borderRadius: 12, borderWidth: 3, overflow: "hidden" },
  img: { width: "100%", height: "100%" },
});

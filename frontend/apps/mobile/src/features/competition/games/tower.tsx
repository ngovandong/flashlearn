import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { buildMcqQuestions, ghostScoreAt } from "@flashlearn/core";
import type { GameProps } from "../types";
import { OptionButtons } from "./OptionButtons";

const DURATION_MS = 60_000;
const FEEDBACK_MS = 350;
const BLOCK_H = 16;

export default function TowerGame({ pool, best, sound, onScore, onGameOver }: GameProps) {
  const theme = useTheme();
  const deck = useMemo(() => buildMcqQuestions(pool.terms), [pool]);
  const [index, setIndex] = useState(0);
  const [blocks, setBlocks] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(DURATION_MS);
  const [ghost, setGhost] = useState(0);
  const start = useRef(Date.now());
  const feedback = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const blocksRef = useRef(0);

  const question = deck[index % (deck.length || 1)];

  useEffect(() => onScore(blocks), [blocks, onScore]);

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - start.current;
      const left = Math.max(0, DURATION_MS - elapsed);
      setRemaining(left);
      setGhost(ghostScoreAt(elapsed, DURATION_MS, best));
      if (left <= 0) {
        clearInterval(id);
        onGameOver(blocksRef.current);
      }
    }, 200);
    return () => {
      clearInterval(id);
      clearTimeout(feedback.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answer = (option: string) => {
    if (picked || !question || remaining <= 0) return;
    const correct = option === question.answer;
    setPicked(option);
    if (correct) {
      blocksRef.current += 1;
      setBlocks(blocksRef.current);
    }
    feedback.current = setTimeout(() => {
      setIndex((i) => i + 1);
      setPicked(null);
    }, FEEDBACK_MS);
  };

  const seconds = Math.ceil(remaining / 1000);
  const ghostBlocks = Math.floor(ghost);

  return (
    <View style={styles.wrap}>
      <Text
        variant="titleMedium"
        style={{ color: seconds <= 10 ? theme.colors.error : theme.colors.primary, textAlign: "center" }}
      >
        {seconds}s
      </Text>
      <View style={styles.arena}>
        <View style={styles.stack}>
          {Array.from({ length: blocks }).map((_, i) => (
            <View key={i} style={[styles.block, { backgroundColor: theme.colors.primary }]} />
          ))}
        </View>
        {ghostBlocks > 0 ? (
          <View style={[styles.ghost, { bottom: ghostBlocks * (BLOCK_H + 3), borderColor: theme.colors.onSurfaceVariant }]}>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}>ghost</Text>
          </View>
        ) : null}
      </View>

      {question ? (
        <View style={styles.quiz}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface, textAlign: "center" }}>
            {question.prompt}
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
  wrap: { flex: 1, padding: 16, gap: 12 },
  arena: { height: 180, alignItems: "center", justifyContent: "flex-end" },
  stack: { flexDirection: "column-reverse", gap: 3, width: 90 },
  block: { height: BLOCK_H, borderRadius: 4 },
  ghost: { position: "absolute", right: "50%", marginRight: -80, borderTopWidth: 2, borderStyle: "dashed", width: 50, paddingTop: 2 },
  quiz: { gap: 12 },
});

import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
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
const FEEDBACK_MS = 900;

export default function BuzzerGame({ pool, sound, onScore, onGameOver }: GameProps) {
  const theme = useTheme();
  const questions = useMemo(() => buildMcqQuestions(pool.terms, TOTAL), [pool]);
  const total = questions.length || TOTAL;
  const [index, setIndex] = useState(0);
  const [combo, setCombo] = useState(initialComboState);
  const [botScore, setBotScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [botBuzzed, setBotBuzzed] = useState(false);
  const buzz = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const next = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const question = questions[index];

  useEffect(() => onScore(combo.score), [combo.score, onScore]);

  useEffect(() => {
    if (!question) return undefined;
    setPicked(null);
    setBotBuzzed(false);
    const decision = simulateBotAnswer("medium");
    buzz.current = setTimeout(() => {
      setBotBuzzed(true);
      if (decision.correct) {
        setBotScore((s) => s + 1);
        setCombo((c) => applyAnswer(c, false));
        advance();
      }
    }, decision.delayMs);
    return () => {
      clearTimeout(buzz.current);
      clearTimeout(next.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, question]);

  const advance = () => {
    next.current = setTimeout(() => {
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

  const answer = (option: string) => {
    if (picked || botBuzzed || !question) return;
    clearTimeout(buzz.current);
    const correct = option === question.answer;
    setPicked(option);
    if (correct) sound.say(question.answer);
    setCombo((c) => applyAnswer(c, correct));
    advance();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.scores}>
        <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
          You {combo.score}
        </Text>
        <Text variant="titleMedium" style={{ color: botBuzzed ? theme.colors.error : theme.colors.onSurfaceVariant }}>
          🤖 {botScore}
        </Text>
      </View>
      {question ? (
        <View style={styles.quiz}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface, textAlign: "center" }}>
            {question.prompt}
          </Text>
          {botBuzzed && !picked ? (
            <Text style={{ color: theme.colors.error, textAlign: "center", fontWeight: "700" }}>
              Bot buzzed first!
            </Text>
          ) : (
            <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
              {index + 1} / {total}
            </Text>
          )}
          <OptionButtons
            options={question.options}
            answer={question.answer}
            picked={picked}
            disabled={botBuzzed}
            onPick={answer}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 16 },
  scores: { flexDirection: "row", justifyContent: "space-between" },
  quiz: { gap: 12 },
});

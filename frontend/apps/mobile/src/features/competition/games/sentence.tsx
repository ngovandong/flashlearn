import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, TextInput, useTheme } from "react-native-paper";
import {
  applyAnswer,
  buildSentenceQuestions,
  checkAnswer,
  initialComboState,
} from "@flashlearn/core";
import type { GameProps } from "../types";

const ROUNDS = 8;
const FEEDBACK_MS = 1200;

export default function SentenceGame({ pool, sound, onScore, onGameOver }: GameProps) {
  const theme = useTheme();
  const deck = useMemo(() => buildSentenceQuestions(pool.terms), [pool]);
  const total = Math.min(ROUNDS, deck.length) || deck.length;
  const [index, setIndex] = useState(0);
  const [combo, setCombo] = useState(initialComboState);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"correct" | "wrong" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const question = deck[index % (deck.length || 1)];
  const [before, after] = (question?.sentence ?? "").split("_____");

  useEffect(() => onScore(combo.score), [combo.score, onScore]);
  useEffect(() => {
    setValue("");
    setStatus(null);
    return () => clearTimeout(timer.current);
  }, [index]);

  const submit = () => {
    if (status || !question || !value.trim()) return;
    const result = checkAnswer(value, question.answer);
    if (result.isCorrect) {
      sound.say(question.answer);
      setStatus("correct");
      setCombo((c) => applyAnswer(c, true));
    } else {
      setStatus("wrong");
      setCombo((c) => applyAnswer(c, false));
    }
    timer.current = setTimeout(() => {
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

  return (
    <View style={styles.wrap}>
      <Text style={{ color: theme.colors.onSurfaceVariant, alignSelf: "flex-end" }}>
        {Math.min(index + 1, total)} / {total}
      </Text>
      {question ? (
        <>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, lineHeight: 30 }}>
            {before}
            <Text
              style={{
                fontWeight: "800",
                color:
                  status === "correct"
                    ? "#2e7d32"
                    : status === "wrong"
                    ? theme.colors.error
                    : theme.colors.primary,
              }}
            >
              {status ? question.answer : " _____ "}
            </Text>
            {after}
          </Text>
          {question.hint ? (
            <Text style={{ color: theme.colors.onSurfaceVariant }}>Hint: {question.hint}</Text>
          ) : null}
          <TextInput
            mode="outlined"
            value={value}
            onChangeText={setValue}
            placeholder="Type the missing word"
            autoCapitalize="none"
            autoCorrect={false}
            disabled={!!status}
            onSubmitEditing={submit}
          />
          <Button mode="contained" onPress={submit} disabled={!!status} icon="target">
            Fire
          </Button>
          {status === "wrong" ? (
            <Text style={{ color: theme.colors.error }}>Answer: {question.answer}</Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 14 },
});

import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Button, Text, TextInput, useTheme } from "react-native-paper";
import { checkAnswer, diffAnswer } from "@flashlearn/core";
import type { Question } from "@flashlearn/core";

interface Props {
  question: Question;
  onAnswer: (correct: boolean) => void;
  disabled?: boolean;
}

export function FillQuestion({ question, onAnswer, disabled }: Props) {
  const theme = useTheme();
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof checkAnswer> | null>(null);

  const submit = () => {
    if (disabled || submitted) return;
    const r = checkAnswer(value, question.answer);
    setResult(r);
    setSubmitted(true);
    onAnswer(r.isCorrect);
  };

  const diff = submitted && result && !result.isCorrect ? diffAnswer(value, question.answer) : null;

  return (
    <View style={styles.wrap}>
      {question.question ? (
        <Text variant="titleLarge" style={{ color: theme.colors.onSurface, textAlign: "center" }}>
          {question.question}
        </Text>
      ) : null}
      <TextInput
        mode="outlined"
        value={value}
        onChangeText={setValue}
        disabled={disabled || submitted}
        onSubmitEditing={submit}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {!submitted ? (
        <Button mode="contained" onPress={submit} disabled={disabled || !value.trim()}>
          Check
        </Button>
      ) : null}
      {submitted && result ? (
        <Text
          style={{
            color: result.isCorrect ? "#2e7d32" : theme.colors.error,
            textAlign: "center",
          }}
        >
          {result.isCorrect ? "Correct!" : `Answer: ${question.answer}`}
        </Text>
      ) : null}
      {diff ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {diff.correct.map((seg, i) => (
            <Text key={i} style={{ color: seg.match ? theme.colors.onSurface : theme.colors.error }}>
              {seg.text}
            </Text>
          ))}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16, padding: 16 },
});

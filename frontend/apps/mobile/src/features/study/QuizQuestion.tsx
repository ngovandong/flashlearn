import React from "react";
import { View, StyleSheet } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { checkAnswer } from "@flashlearn/core";
import type { Question } from "@flashlearn/core";

interface Props {
  question: Question;
  onAnswer: (correct: boolean) => void;
  disabled?: boolean;
}

export function QuizQuestion({ question, onAnswer, disabled }: Props) {
  const theme = useTheme();

  const pick = (option: string) => {
    if (disabled) return;
    const result = checkAnswer(option, question.answer);
    onAnswer(result.isCorrect);
  };

  return (
    <View style={styles.wrap}>
      {question.question ? (
        <Text variant="titleLarge" style={{ color: theme.colors.onSurface, textAlign: "center" }}>
          {question.question}
        </Text>
      ) : null}
      <View style={styles.options}>
        {(question.options ?? []).map((opt) => (
          <Button
            key={opt}
            mode="outlined"
            onPress={() => pick(opt)}
            disabled={disabled}
            style={styles.optionBtn}
            contentStyle={styles.optionContent}
          >
            {opt}
          </Button>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20, padding: 16 },
  options: { gap: 10 },
  optionBtn: { borderRadius: 10 },
  optionContent: { minHeight: 48 },
});

import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, TextInput, useTheme } from "react-native-paper";
import * as Speech from "expo-speech";
import { numberToEnglishWords, checkAnswer } from "@flashlearn/core";

function randomNumber(): number {
  return Math.floor(Math.random() * 9000) + 100;
}

export default function NumberListeningScreen() {
  const theme = useTheme();
  const [target, setTarget] = useState(randomNumber);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const play = () => {
    Speech.stop();
    Speech.speak(String(target), { language: "en-US" });
  };

  const check = () => {
    const words = numberToEnglishWords(target);
    const r = checkAnswer(value, words);
    setScore((s) => ({ correct: s.correct + (r.isCorrect ? 1 : 0), total: s.total + 1 }));
    setResult(r.isCorrect ? "Correct!" : `Answer: ${words}`);
  };

  const next = () => {
    setTarget(randomNumber());
    setValue("");
    setResult(null);
  };

  return (
    <View style={[styles.pad, { backgroundColor: theme.colors.background, flex: 1 }]}>
      <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
        Type the number you hear
      </Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
        Score: {score.correct}/{score.total}
      </Text>
      <Button mode="contained-tonal" icon="volume-up" onPress={play} style={{ marginTop: 16 }}>
        Play number
      </Button>
      <TextInput
        mode="outlined"
        label="Your answer (words)"
        value={value}
        onChangeText={setValue}
        style={{ marginTop: 16 }}
        autoCapitalize="none"
      />
      <View style={styles.row}>
        <Button mode="contained" onPress={check} disabled={!value.trim()}>
          Check
        </Button>
        <Button mode="outlined" onPress={next}>
          Next
        </Button>
      </View>
      {result ? (
        <Text style={{ color: result.startsWith("Correct") ? "#2e7d32" : theme.colors.error, marginTop: 12 }}>
          {result}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16 },
  row: { flexDirection: "row", gap: 10, marginTop: 16 },
});

import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { numberToEnglishWords, checkAnswer } from "@flashlearn/core";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { AppCard } from "@/components/ui/AppCard";
import { GradientButton } from "@/components/ui/GradientButton";
import { GradientSurface } from "@/components/ui/GradientSurface";
import { useTokens } from "@/theme/tokens";

function randomNumber(): number {
  return Math.floor(Math.random() * 9000) + 100;
}

export default function NumberListeningScreen() {
  const t = useTokens();
  const [target, setTarget] = useState(randomNumber);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<{ correct: boolean; words: string } | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const play = () => {
    Speech.stop();
    Speech.speak(String(target), { language: "en-US" });
  };

  const check = () => {
    const words = numberToEnglishWords(target);
    const r = checkAnswer(value, words);
    setScore((s) => ({ correct: s.correct + (r.isCorrect ? 1 : 0), total: s.total + 1 }));
    setResult({ correct: r.isCorrect, words });
  };

  const next = () => {
    setTarget(randomNumber());
    setValue("");
    setResult(null);
  };

  const accuracy = score.total ? Math.round((score.correct / score.total) * 100) : 0;

  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <View style={styles.pad}>
        <FadeSlideIn>
          <GradientSurface style={[styles.hero, { borderRadius: t.radii.lg }]}>
            <MaterialIcons name="hearing" size={30} color="#ffffff" />
            <Text style={styles.heroTitle}>Type the number you hear</Text>
            <Text style={styles.heroSub}>
              Score {score.correct}/{score.total} · {accuracy}%
            </Text>
            <PressableScale onPress={play} style={styles.playBtn}>
              <MaterialIcons name="volume-up" size={22} color={t.palette.primary} />
              <Text style={{ color: t.palette.primary, fontWeight: "800", fontSize: 16 }}>Play number</Text>
            </PressableScale>
          </GradientSurface>
        </FadeSlideIn>

        <FadeSlideIn delay={60}>
          <AppCard style={{ marginTop: 16 }}>
            <TextInput
              mode="outlined"
              label="Your answer (in words)"
              value={value}
              onChangeText={setValue}
              autoCapitalize="none"
              outlineStyle={{ borderRadius: t.radii.md }}
              style={styles.input}
            />
            <View style={styles.row}>
              <GradientButton label="Check" onPress={check} disabled={!value.trim()} style={{ flex: 1 }} />
              <PressableScale
                onPress={next}
                style={[styles.nextBtn, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}
              >
                <Text style={{ color: t.neutral.text, fontWeight: "700" }}>Next</Text>
                <MaterialIcons name="chevron-right" size={20} color={t.neutral.text} />
              </PressableScale>
            </View>

            {result ? (
              <View
                style={[
                  styles.result,
                  {
                    backgroundColor: result.correct ? t.alpha("#10b981", 0.12) : t.alpha("#ef4444", 0.12),
                    borderRadius: t.radii.md,
                  },
                ]}
              >
                <MaterialIcons
                  name={result.correct ? "check-circle" : "cancel"}
                  size={20}
                  color={result.correct ? "#10b981" : "#ef4444"}
                />
                <Text style={{ color: result.correct ? "#0f9b6c" : "#ef4444", fontWeight: "700", flex: 1 }}>
                  {result.correct ? "Correct!" : `Answer: ${result.words}`}
                </Text>
              </View>
            ) : null}
          </AppCard>
        </FadeSlideIn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: 16 },
  hero: { padding: 20, alignItems: "center" },
  heroTitle: { color: "#ffffff", fontWeight: "800", fontSize: 18, marginTop: 10, textAlign: "center" },
  heroSub: { color: "rgba(255,255,255,0.85)", marginTop: 4, fontWeight: "600" },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginTop: 16,
  },
  input: { backgroundColor: "transparent" },
  row: { flexDirection: "row", gap: 10, marginTop: 14, alignItems: "center" },
  nextBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 18, height: 52 },
  result: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginTop: 14 },
});

import React, { useState } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { numberToEnglishWords } from "@flashlearn/core";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { AppCard } from "@/components/ui/AppCard";
import { GradientButton } from "@/components/ui/GradientButton";
import { GradientSurface } from "@/components/ui/GradientSurface";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { useFloatingTabBarHeight } from "@/components/ui/FloatingTabBar";
import { useTokens } from "@/theme/tokens";

// Mirrors the web deck-scoped number test (`numberTest/index.js`) config depth —
// range modes, round size, speech rate, digit-by-digit sequences, and a
// results table — but skips deck-scoping (kept out on purpose) and native
// voice picking (the OS handles that; we only vary the speech rate).

type Mode = "digits" | "teens-tens" | "hundreds" | "thousands" | "millions" | "sequence" | "custom";
type GameState = "setup" | "playing" | "finished";

const MODES: { value: Mode; label: string; range: string }[] = [
  { value: "digits", label: "Digits", range: "0 – 9" },
  { value: "teens-tens", label: "Teens & tens", range: "10 – 90" },
  { value: "hundreds", label: "Hundreds", range: "100 – 999" },
  { value: "thousands", label: "Thousands", range: "1,000 – 9,999" },
  { value: "millions", label: "Millions", range: "1M – 9.9M" },
  { value: "sequence", label: "Phone / tax / ID", range: "Digit by digit" },
  { value: "custom", label: "Custom", range: "Your range" },
];

const ROUND_SIZES = [5, 10, 20, 50];
const SPEEDS = [0.75, 1.0, 1.25];

const DIGIT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

type NumValue = number | string;

function isSequenceValue(value: NumValue): value is string {
  return typeof value === "string";
}

function spellNumber(value: NumValue): string {
  if (isSequenceValue(value)) {
    return value
      .split("")
      .map((d) => DIGIT_WORDS[parseInt(d, 10)] ?? d)
      .join(" ");
  }
  return numberToEnglishWords(value);
}

interface HistoryItem {
  number: NumValue;
  userInput: string;
  correct: boolean;
  playCount: number;
}

export default function NumberListeningScreen() {
  const t = useTokens();
  const tabBarHeight = useFloatingTabBarHeight();

  // Setup
  const [mode, setMode] = useState<Mode>("custom");
  const [customMin, setCustomMin] = useState("10");
  const [customMax, setCustomMax] = useState("10000000");
  const [roundSize, setRoundSize] = useState(10);
  const [speed, setSpeed] = useState(1.0);

  // Game
  const [gameState, setGameState] = useState<GameState>("setup");
  const [numbers, setNumbers] = useState<NumValue[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [playCount, setPlayCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const generateNumber = (): NumValue => {
    let min = 0;
    let max = 100;
    switch (mode) {
      case "digits":
        min = 0;
        max = 9;
        break;
      case "teens-tens": {
        if (Math.random() < 0.5) {
          min = 10;
          max = 19;
        } else {
          const tensValues = [20, 30, 40, 50, 60, 70, 80, 90];
          return tensValues[Math.floor(Math.random() * tensValues.length)];
        }
        break;
      }
      case "hundreds":
        min = 100;
        max = 999;
        break;
      case "thousands":
        min = 1000;
        max = 9999;
        break;
      case "millions":
        min = 1000000;
        max = 9999999;
        break;
      case "sequence": {
        const formats = [
          { len: 10, lead: "0" },
          { len: 10, lead: "" },
          { len: 12, lead: "0" },
        ];
        const fmt = formats[Math.floor(Math.random() * formats.length)];
        let digits = fmt.lead;
        while (digits.length < fmt.len) digits += Math.floor(Math.random() * 10);
        return digits;
      }
      case "custom":
        min = Math.max(0, parseInt(customMin, 10) || 0);
        max = Math.max(1, parseInt(customMax, 10) || 100);
        if (min > max) [min, max] = [max, min];
        break;
      default:
        break;
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  const playVoice = (numToPlay?: NumValue) => {
    const value = numToPlay !== undefined ? numToPlay : numbers[currentIndex];
    if (value === undefined) return;
    Speech.stop();
    const spoken = isSequenceValue(value) ? value.split("").join(", ") : String(value);
    Speech.speak(spoken, {
      language: "en-US",
      rate: speed,
      onStart: () => setIsPlaying(true),
      onDone: () => setIsPlaying(false),
      onStopped: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
    setPlayCount((p) => p + 1);
  };

  const startTest = () => {
    const generated = Array.from({ length: roundSize }, () => generateNumber());
    setNumbers(generated);
    setCurrentIndex(0);
    setUserInput("");
    setPlayCount(0);
    setHistory([]);
    setIsChecked(false);
    setIsCorrect(false);
    setGameState("playing");
    setTimeout(() => playVoice(generated[0]), 300);
  };

  const handleCheck = () => {
    if (!userInput.trim()) return;
    const expected = String(numbers[currentIndex]);
    const correct = userInput.trim() === expected;
    setIsCorrect(correct);
    setIsChecked(true);
  };

  const handleShowAnswer = () => {
    setUserInput(String(numbers[currentIndex]));
    setIsCorrect(false);
    setIsChecked(true);
  };

  const handleNext = () => {
    const record: HistoryItem = {
      number: numbers[currentIndex],
      userInput,
      correct: isCorrect,
      playCount,
    };
    const nextHistory = [...history, record];
    setHistory(nextHistory);

    if (currentIndex + 1 < numbers.length) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      setUserInput("");
      setPlayCount(0);
      setIsChecked(false);
      setIsCorrect(false);
      setTimeout(() => playVoice(numbers[next]), 300);
    } else {
      setGameState("finished");
    }
  };

  const correctCount = history.filter((h) => h.correct).length;
  const accuracy = history.length ? Math.round((correctCount / history.length) * 100) : 0;
  const avgPlayCount = history.length
    ? (history.reduce((s, h) => s + h.playCount, 0) / history.length).toFixed(1)
    : "0.0";

  // ── Setup screen ──────────────────────────────────────────────────────
  if (gameState === "setup") {
    return (
      <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
        <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: tabBarHeight }]} keyboardShouldPersistTaps="handled">
          <FadeSlideIn>
              <AppCard>
                <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800" }}>
                  Number listening
                </Text>
                <Text style={{ color: t.neutral.textMinor, marginTop: 4 }}>
                  Configure the range, round size and speech rate, then start.
                </Text>

                <Text style={styles.sectionLabel}>Number range</Text>
                <View style={styles.wrapRow}>
                  {MODES.map((m) => {
                    const active = m.value === mode;
                    return (
                      <PressableScale
                        key={m.value}
                        onPress={() => setMode(m.value)}
                        style={[
                          styles.modeChip,
                          {
                            backgroundColor: active ? t.palette.primary : t.neutral.surface2,
                            borderRadius: t.radii.md,
                          },
                        ]}
                      >
                        <Text style={{ color: active ? t.palette.onPrimary : t.neutral.text, fontWeight: "700" }}>
                          {m.label}
                        </Text>
                        <Text style={{ color: active ? t.palette.onPrimary : t.neutral.textMinor, fontSize: 12 }}>
                          {m.range}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>

                {mode === "custom" ? (
                  <View style={styles.customRow}>
                    <TextInput
                      mode="outlined"
                      label="Min value"
                      value={customMin}
                      onChangeText={setCustomMin}
                      keyboardType="number-pad"
                      style={[styles.customInput, { backgroundColor: "transparent" }]}
                    />
                    <TextInput
                      mode="outlined"
                      label="Max value"
                      value={customMax}
                      onChangeText={setCustomMax}
                      keyboardType="number-pad"
                      style={[styles.customInput, { backgroundColor: "transparent" }]}
                    />
                  </View>
                ) : null}

                <Text style={styles.sectionLabel}>Round size</Text>
                <View style={styles.wrapRow}>
                  {ROUND_SIZES.map((size) => {
                    const active = size === roundSize;
                    return (
                      <PressableScale
                        key={size}
                        onPress={() => setRoundSize(size)}
                        style={[
                          styles.pill,
                          {
                            backgroundColor: active ? t.palette.primary : t.neutral.surface2,
                            borderRadius: t.radii.pill,
                          },
                        ]}
                      >
                        <Text style={{ color: active ? t.palette.onPrimary : t.neutral.text, fontWeight: "700" }}>
                          {size}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>

                <Text style={styles.sectionLabel}>Speech speed</Text>
                <View style={styles.wrapRow}>
                  {SPEEDS.map((s) => {
                    const active = s === speed;
                    return (
                      <PressableScale
                        key={s}
                        onPress={() => setSpeed(s)}
                        style={[
                          styles.pill,
                          {
                            backgroundColor: active ? t.palette.primary : t.neutral.surface2,
                            borderRadius: t.radii.pill,
                          },
                        ]}
                      >
                        <Text style={{ color: active ? t.palette.onPrimary : t.neutral.text, fontWeight: "700" }}>
                          {s}x
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>

                <GradientButton
                  label="Start practice"
                  icon="play-arrow"
                  onPress={startTest}
                  style={{ marginTop: 20 }}
                />
              </AppCard>
          </FadeSlideIn>
        </ScrollView>
      </View>
    );
  }

  // ── Finished screen ───────────────────────────────────────────────────
  if (gameState === "finished") {
    return (
      <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
        <FlatList
          data={history}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={[styles.pad, { paddingBottom: tabBarHeight }]}
          ListHeaderComponent={
            <FadeSlideIn>
              <AppCard style={{ alignItems: "center" }}>
                <Text variant="titleLarge" style={{ color: t.neutral.text, fontWeight: "800" }}>
                  Round completed!
                </Text>
                <View style={{ marginTop: 16 }}>
                  <ProgressRing value={accuracy} size={120} strokeWidth={10} />
                </View>
                <Text style={{ color: t.neutral.textMinor, marginTop: 12 }}>
                  {correctCount} / {history.length} correct · avg {avgPlayCount} plays
                </Text>
                <View style={styles.finishActions}>
                  <PressableScale
                    onPress={() => setGameState("setup")}
                    style={[styles.finishBtn, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}
                  >
                    <MaterialIcons name="settings" size={18} color={t.neutral.text} />
                    <Text style={{ color: t.neutral.text, fontWeight: "700" }}>Adjust settings</Text>
                  </PressableScale>
                  <GradientButton label="Another round" icon="refresh" onPress={startTest} style={{ flex: 1 }} />
                </View>
              </AppCard>
              <Text style={styles.sectionLabel}>Review session</Text>
            </FadeSlideIn>
          }
          renderItem={({ item, index }) => (
            <FadeSlideIn delay={Math.min(index, 8) * 30}>
              <AppCard
                flat
                padding={12}
                style={{
                  marginBottom: 8,
                  borderColor: item.correct ? "#22c55e" : "#ef4444",
                  borderWidth: 1,
                }}
              >
                <View style={styles.historyRow}>
                  <PressableScale onPress={() => playVoice(item.number)} hitSlop={8}>
                    <MaterialIcons name="volume-up" size={20} color={t.palette.primary} />
                  </PressableScale>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.neutral.text, fontWeight: "800" }}>{item.number}</Text>
                    <Text style={{ color: t.neutral.textMinor, fontSize: 12 }}>{spellNumber(item.number)}</Text>
                  </View>
                  <Text style={{ color: t.neutral.textMinor }}>
                    {item.userInput || "Skipped"}
                  </Text>
                  <MaterialIcons
                    name={item.correct ? "check-circle" : "cancel"}
                    size={20}
                    color={item.correct ? "#22c55e" : "#ef4444"}
                  />
                </View>
              </AppCard>
            </FadeSlideIn>
          )}
        />
      </View>
    );
  }

  // ── Playing screen ────────────────────────────────────────────────────
  const target = numbers[currentIndex];
  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <View style={styles.pad}>
        <FadeSlideIn>
          <View style={styles.progressHead}>
            <Text style={{ color: t.neutral.textMinor, fontWeight: "700" }}>
              Question {currentIndex + 1} of {numbers.length}
            </Text>
            <Text style={{ color: t.neutral.textMinor, fontWeight: "700" }}>Plays: {playCount}</Text>
          </View>

          <GradientSurface style={[styles.hero, { borderRadius: t.radii.lg, marginTop: 12 }]}>
            <PressableScale onPress={() => playVoice()} style={styles.playBtn}>
              <MaterialIcons name={isPlaying ? "graphic-eq" : "volume-up"} size={26} color={t.palette.primary} />
            </PressableScale>
            <Text style={styles.heroSub}>{isPlaying ? "Speaking…" : "Tap to listen"}</Text>
          </GradientSurface>
        </FadeSlideIn>

        <FadeSlideIn delay={60}>
          <AppCard style={{ marginTop: 16 }}>
            <TextInput
              mode="outlined"
              label={isSequenceValue(target) ? "Type the digits you hear" : "Type the number you hear"}
              value={userInput}
              onChangeText={setUserInput}
              keyboardType="number-pad"
              editable={!isChecked}
              outlineStyle={{ borderRadius: t.radii.md }}
              style={{ backgroundColor: "transparent" }}
            />

            {isChecked ? (
              <View
                style={[
                  styles.feedback,
                  { backgroundColor: isCorrect ? t.alpha("#22c55e", 0.12) : t.alpha("#ef4444", 0.12) },
                ]}
              >
                <View style={styles.rowCenter}>
                  <MaterialIcons
                    name={isCorrect ? "check-circle" : "cancel"}
                    size={20}
                    color={isCorrect ? "#22c55e" : "#ef4444"}
                  />
                  <Text style={{ color: isCorrect ? "#22c55e" : "#ef4444", fontWeight: "800" }}>
                    {isCorrect ? "Correct!" : "Incorrect"}
                  </Text>
                </View>
                <Text style={{ color: t.neutral.text, marginTop: 6, fontStyle: "italic" }}>
                  "{spellNumber(target)}"
                </Text>
                {!isCorrect ? (
                  <Text style={{ color: t.neutral.textMinor, marginTop: 2 }}>
                    Correct digits: {String(target)}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.row}>
              {!isChecked ? (
                <>
                  <PressableScale
                    onPress={() => setUserInput("")}
                    style={[styles.secondaryBtn, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}
                  >
                    <Text style={{ color: t.neutral.text, fontWeight: "700" }}>Clear</Text>
                  </PressableScale>
                  <PressableScale
                    onPress={handleShowAnswer}
                    style={[styles.secondaryBtn, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}
                  >
                    <Text style={{ color: t.neutral.text, fontWeight: "700" }}>Show answer</Text>
                  </PressableScale>
                  <GradientButton label="Check" onPress={handleCheck} disabled={!userInput.trim()} style={{ flex: 1 }} />
                </>
              ) : (
                <GradientButton label="Next question" icon="chevron-right" onPress={handleNext} style={{ flex: 1 }} />
              )}
            </View>
          </AppCard>
        </FadeSlideIn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 12, fontWeight: "700", opacity: 0.6, textTransform: "uppercase", marginTop: 16, marginBottom: 8 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modeChip: { paddingHorizontal: 14, paddingVertical: 10, minWidth: "30%" },
  pill: { paddingHorizontal: 16, paddingVertical: 8 },
  customRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  customInput: { flex: 1 },
  progressHead: { flexDirection: "row", justifyContent: "space-between" },
  hero: { padding: 24, alignItems: "center" },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  heroSub: { color: "rgba(255,255,255,0.9)", marginTop: 10, fontWeight: "700" },
  feedback: { marginTop: 14, padding: 12, borderRadius: 12 },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  row: { flexDirection: "row", gap: 10, marginTop: 14, alignItems: "center" },
  secondaryBtn: { paddingHorizontal: 14, height: 48, alignItems: "center", justifyContent: "center" },
  finishActions: { flexDirection: "row", gap: 10, marginTop: 18, width: "100%" },
  finishBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, height: 48, justifyContent: "center" },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
});

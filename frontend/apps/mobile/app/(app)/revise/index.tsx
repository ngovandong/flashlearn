import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ReviseCard } from "@flashlearn/core";
import { reviseApi, userSettingsApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { AppCard } from "@/components/ui/AppCard";
import { GradientButton } from "@/components/ui/GradientButton";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { AnimatedBar } from "@/components/ui/AnimatedBar";
import { useFloatingTabBarHeight } from "@/components/ui/FloatingTabBar";
import { AudioRecorder, playAudioUrl, speakText, stopPlayback } from "@/utils/audio";
import { unwrap } from "@/utils/apiError";
import { useTokens, type Tokens } from "@/theme/tokens";

const SESSION_SIZE = 12;
const GREEN = "#10b981";
const RED = "#ef4444";

const KIND_ICON: Record<string, string> = {
  vocab: "style",
  grammar: "spellcheck",
  listening: "headphones",
  speaking: "record-voice-over",
};

type Tone = "correct" | "wrong" | "dim" | undefined;

/** Format an answer value (string or array-of-blanks) for the reveal text. */
function formatAnswer(answer: unknown): string {
  if (Array.isArray(answer)) {
    return answer.map((a) => (Array.isArray(a) ? a[0] : a)).join(", ");
  }
  return answer != null ? String(answer) : "";
}

/** Selectable answer option row, tinted green/red once the card is graded. */
function OptionRow({
  label,
  onPress,
  disabled,
  tone,
  t,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: Tone;
  t: Tokens;
}) {
  const toneStyle =
    tone === "correct"
      ? { backgroundColor: t.alpha(GREEN, 0.16), borderColor: GREEN, borderWidth: 1.5 }
      : tone === "wrong"
      ? { backgroundColor: t.alpha(RED, 0.16), borderColor: RED, borderWidth: 1.5 }
      : {};
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.option,
        { backgroundColor: t.neutral.surface2, borderRadius: t.radii.md, opacity: tone === "dim" ? 0.5 : disabled ? 0.6 : 1 },
        toneStyle,
      ]}
    >
      <Text style={{ color: t.neutral.text, fontWeight: "600" }}>{label}</Text>
    </PressableScale>
  );
}

export default function MixedReviseScreen() {
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useFloatingTabBarHeight();
  const [cards, setCards] = useState<ReviseCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<{ correct: boolean; answer?: unknown; blanks?: boolean[]; score?: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [done, setDone] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [blanks, setBlanks] = useState<Record<number, string>>({});
  const [chosen, setChosen] = useState<string | null>(null);
  const recorder = React.useRef(new AudioRecorder());
  const [recording, setRecording] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const loadSession = useCallback(() => {
    let active = true;
    setCards(null);
    reviseApi.buildSession(SESSION_SIZE).then((res) => {
      if (!active) return;
      try {
        const data = unwrap<{ cards: ReviseCard[] }>(res);
        setCards(data.cards ?? []);
      } catch {
        setCards([]);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => loadSession(), [loadSession]);

  // Release any playing clip / in-progress recording when leaving the screen.
  useEffect(
    () => () => {
      stopPlayback();
      if (recorder.current.isRecording) recorder.current.cancel();
    },
    []
  );

  const card = cards?.[index];
  const total = cards?.length ?? 0;

  const isChooseGrammar = useMemo(() => {
    const p = card?.payload || {};
    return (
      card?.kind === "grammar" &&
      p.exercise_kind === "choose" &&
      Array.isArray(p.options) &&
      (p.options as string[]).length > 0 &&
      p.blank_count === 1
    );
  }, [card]);

  const blankCount = (card?.payload?.blank_count as number) || 1;

  const submit = useCallback(
    async (given: unknown, opts?: { audio?: string; mimeType?: string }) => {
      if (submitting || result || !card) return;
      setSubmitting(true);
      const res = opts?.audio
        ? await reviseApi.answerSpeaking(card.id, { audio: opts.audio, mimeType: opts.mimeType ?? "audio/m4a" })
        : await reviseApi.answer(card.id, given);
      setSubmitting(false);
      try {
        const data = unwrap<{ correct: boolean; answer?: unknown; blanks?: boolean[]; score?: number }>(res);
        setResult(data);
        if (data.correct) {
          setScore((s) => s + 1);
          setStreak((s) => s + 1);
        } else {
          setStreak(0);
        }
      } catch {
        setResult({ correct: false });
        setStreak(0);
      }
    },
    [submitting, result, card]
  );

  const checkTyped = () => {
    if (!card) return;
    if (card.kind === "listening") submit(textValue);
    else submit(Array.from({ length: blankCount }, (_, i) => blanks[i] || ""));
  };

  const advance = async () => {
    if (index + 1 >= total) {
      setDone(true);
      await userSettingsApi.recordStudyActivity();
    } else {
      setIndex((i) => i + 1);
      setResult(null);
      setTextValue("");
      setBlanks({});
      setChosen(null);
    }
  };

  const restart = () => {
    setIndex(0);
    setResult(null);
    setTextValue("");
    setBlanks({});
    setChosen(null);
    setScore(0);
    setStreak(0);
    setDone(false);
    loadSession();
  };

  if (cards === null) return <LoadingView />;
  if (cards.length === 0) return <ErrorView message="Nothing to revise right now" onRetry={() => router.back()} />;

  if (done) {
    const pct = total ? Math.round((score / total) * 100) : 0;
    return (
      <View style={[styles.center, { backgroundColor: t.neutral.bg }]}>
        <FadeSlideIn>
          <View style={styles.doneInner}>
            <ProgressRing value={pct} size={150} strokeWidth={12} />
            <Text variant="headlineSmall" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 20 }}>
              Session complete
            </Text>
            <Text variant="titleMedium" style={{ color: t.neutral.textMinor, marginTop: 4 }}>
              {score} / {total} correct
            </Text>
            <GradientButton label="Revise more" icon="autorenew" onPress={restart} style={styles.doneBtn} />
            <PressableScale onPress={() => router.back()} style={styles.doneGhostBtn}>
              <Text style={{ color: t.neutral.textMinor, fontWeight: "700" }}>Done</Text>
            </PressableScale>
          </View>
        </FadeSlideIn>
      </View>
    );
  }

  const payload = card?.payload ?? {};
  const progress = total ? index / total : 0;
  const isTypedGrammar = card?.kind === "grammar" && !isChooseGrammar;
  const isListening = card?.kind === "listening";
  const isTyped = isTypedGrammar || isListening;
  const canCheck = isListening ? textValue.trim().length > 0 : (blanks[0] || "").trim().length > 0;
  const vocabOptions = card?.kind === "vocab" && Array.isArray(payload.options) ? (payload.options as string[]) : null;
  const speakingBusy = preparing || submitting;
  // Backend cards may carry a legacy `answer` field alongside `payload`; the
  // shared ReviseCard type only declares `payload`, so read it defensively.
  const speakingText = String(payload.text ?? (card as { answer?: string } | undefined)?.answer ?? card?.prompt ?? "");

  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} hitSlop={8} style={[styles.iconBtn, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}>
          <MaterialIcons name="close" size={22} color={t.neutral.text} />
        </PressableScale>
        <Text variant="labelLarge" style={{ color: t.neutral.textMinor, fontWeight: "700" }}>
          {index + 1} / {total}
        </Text>
        <View style={[styles.streak, { backgroundColor: t.alpha("#f97316", 0.14), borderRadius: t.radii.pill }]}>
          <MaterialIcons name="local-fire-department" size={16} color="#f97316" />
          <Text style={{ color: "#f97316", fontWeight: "800", fontSize: 13 }}>{streak}</Text>
        </View>
      </View>
      <AnimatedBar progress={progress} color={t.palette.primary} trackColor={t.neutral.surface2} style={styles.bar} />

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: tabBarHeight }]} showsVerticalScrollIndicator={false}>
        <FadeSlideIn>
          <AppCard>
            <View style={[styles.kindPill, { backgroundColor: t.feature(KIND_ICON[card?.kind ?? "vocab"] ?? "style").tint, borderRadius: t.radii.pill }]}>
              <MaterialIcons
                name={(KIND_ICON[card?.kind ?? "vocab"] ?? "style") as any}
                size={14}
                color={t.feature(KIND_ICON[card?.kind ?? "vocab"] ?? "style").fg}
              />
              <Text style={{ color: t.feature(KIND_ICON[card?.kind ?? "vocab"] ?? "style").fg, fontWeight: "800", fontSize: 12, textTransform: "capitalize" }}>
                {card?.kind}
              </Text>
            </View>

            {card?.kind === "vocab" && typeof payload.image === "string" && payload.image ? (
              <Image source={{ uri: payload.image as string }} style={[styles.vocabImage, { borderRadius: t.radii.md }]} resizeMode="cover" />
            ) : null}

            <View style={styles.titleRow}>
              <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "700", flex: 1 }}>
                {card?.prompt ?? String(payload.prompt ?? payload.question ?? "")}
              </Text>
              {card?.kind === "vocab" ? (
                <PressableScale
                  onPress={() => speakText(String(card?.prompt ?? ""))}
                  hitSlop={8}
                  style={[styles.speakBtn, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}
                >
                  <MaterialIcons name="volume-up" size={18} color={t.neutral.text} />
                </PressableScale>
              ) : null}
            </View>
            {card?.kind === "vocab" && typeof payload.pronunciation === "string" && payload.pronunciation ? (
              <Text style={{ color: t.neutral.textMinor, marginTop: 2 }}>{payload.pronunciation as string}</Text>
            ) : null}

            {card?.kind === "speaking" ? (
              <View style={[styles.sayRow, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.md }]}>
                <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "700", flex: 1 }}>
                  {speakingText}
                </Text>
                <PressableScale
                  onPress={() => speakText(speakingText)}
                  hitSlop={8}
                  style={[styles.speakBtn, { backgroundColor: t.neutral.surface, borderRadius: t.radii.pill }]}
                >
                  <MaterialIcons name="volume-up" size={18} color={t.neutral.text} />
                </PressableScale>
              </View>
            ) : null}

            {isListening ? (
              <PressableScale
                onPress={() => {
                  const url = payload.audio_url as string | undefined;
                  if (url) playAudioUrl(url);
                }}
                style={[styles.playBtn, { borderColor: t.palette.primary, borderRadius: t.radii.pill }]}
              >
                <MaterialIcons name="play-arrow" size={20} color={t.palette.primary} />
                <Text style={{ color: t.palette.primary, fontWeight: "800" }}>Play</Text>
              </PressableScale>
            ) : null}

            <View style={{ marginTop: 16, gap: 10 }}>
              {vocabOptions
                ? vocabOptions.map((opt) => {
                    let tone: Tone;
                    if (result) {
                      const correctAnswer = result.answer;
                      if (opt === correctAnswer) tone = "correct";
                      else if (opt === chosen) tone = "wrong";
                      else tone = "dim";
                    }
                    return (
                      <OptionRow
                        key={opt}
                        label={opt}
                        disabled={!!result || submitting}
                        tone={tone}
                        onPress={() => {
                          setChosen(opt);
                          submit(opt);
                        }}
                        t={t}
                      />
                    );
                  })
                : null}

              {isTyped ? (
                <>
                  {isTypedGrammar
                    ? Array.from({ length: blankCount }).map((_, i) => {
                        const blankOk = result?.blanks?.[i];
                        return (
                          <TextInput
                            key={i}
                            mode="outlined"
                            placeholder={blankCount > 1 ? `Answer ${i + 1}` : "Your answer"}
                            value={blanks[i] || ""}
                            onChangeText={(v) => setBlanks((b) => ({ ...b, [i]: v }))}
                            disabled={!!result}
                            outlineColor={result ? (blankOk ? GREEN : RED) : undefined}
                            activeOutlineColor={result ? (blankOk ? GREEN : RED) : t.palette.primary}
                            outlineStyle={{ borderRadius: t.radii.md }}
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={styles.input}
                          />
                        );
                      })
                    : (
                      <TextInput
                        mode="outlined"
                        value={textValue}
                        onChangeText={setTextValue}
                        disabled={!!result}
                        outlineColor={result ? (result.correct ? GREEN : RED) : undefined}
                        activeOutlineColor={result ? (result.correct ? GREEN : RED) : t.palette.primary}
                        outlineStyle={{ borderRadius: t.radii.md }}
                        placeholder="Type what you hear…"
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={styles.input}
                      />
                    )}
                  <GradientButton label="Check" icon="check" onPress={checkTyped} disabled={!!result || !canCheck || submitting} />
                </>
              ) : null}

              {isChooseGrammar && Array.isArray(payload.options)
                ? (payload.options as string[]).map((opt) => {
                    let tone: Tone;
                    if (result && opt === chosen) tone = result.correct ? "correct" : "wrong";
                    return (
                      <OptionRow
                        key={opt}
                        label={opt}
                        disabled={!!result}
                        tone={tone}
                        onPress={() => {
                          setChosen(opt);
                          submit([opt]);
                        }}
                        t={t}
                      />
                    );
                  })
                : null}

              {card?.kind === "speaking" ? (
                speakingBusy ? (
                  <View style={[styles.recordBtn, { borderColor: t.neutral.border }]}>
                    <MaterialIcons name="hourglass-top" size={18} color={t.neutral.textMinor} />
                    <Text style={{ color: t.neutral.textMinor, fontWeight: "800", fontSize: 16 }}>Scoring…</Text>
                  </View>
                ) : recording ? (
                  <GradientButton
                    label="Stop & submit"
                    icon="stop"
                    onPress={async () => {
                      setPreparing(true);
                      const rec = await recorder.current.stop();
                      setRecording(false);
                      if (rec) await submit("", { audio: rec.base64, mimeType: rec.mimeType });
                      setPreparing(false);
                    }}
                    disabled={!!result}
                  />
                ) : (
                  <PressableScale
                    onPress={async () => {
                      try {
                        await recorder.current.start();
                        setRecording(true);
                      } catch {
                        // Mic denied/unavailable — leave the card idle so the user can skip.
                      }
                    }}
                    disabled={!!result}
                    style={[styles.recordBtn, { borderColor: t.palette.primary, borderRadius: t.radii.pill, opacity: result ? 0.5 : 1 }]}
                  >
                    <MaterialIcons name="mic" size={20} color={t.palette.primary} />
                    <Text style={{ color: t.palette.primary, fontWeight: "800", fontSize: 16 }}>Record</Text>
                  </PressableScale>
                )
              ) : null}
            </View>

            {result ? (
              <View
                style={[
                  styles.result,
                  { backgroundColor: result.correct ? t.alpha(GREEN, 0.12) : t.alpha(RED, 0.12), borderRadius: t.radii.md },
                ]}
              >
                <MaterialIcons name={result.correct ? "check-circle" : "cancel"} size={20} color={result.correct ? GREEN : RED} />
                <Text style={{ color: result.correct ? "#0f9b6c" : RED, fontWeight: "700", flex: 1 }}>
                  {result.correct
                    ? card?.kind === "speaking" && typeof result.score === "number"
                      ? `Correct! Pronunciation score: ${result.score}`
                      : "Correct!"
                    : card?.kind === "speaking" && typeof result.score === "number"
                    ? `Keep practising — score: ${result.score}`
                    : `Answer: ${formatAnswer(result.answer)}`}
                </Text>
              </View>
            ) : null}
          </AppCard>
        </FadeSlideIn>
      </ScrollView>

      {result ? (
        <View style={[styles.footer, { backgroundColor: t.neutral.surface, borderTopColor: t.neutral.border, paddingBottom: insets.bottom + 72 }]}>
          <GradientButton label={index + 1 >= total ? "Finish" : "Continue"} icon="arrow-forward" onPress={advance} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  doneInner: { alignItems: "center" },
  doneBtn: { marginTop: 28, minWidth: 220 },
  doneGhostBtn: { marginTop: 16, padding: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  streak: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5 },
  bar: { marginHorizontal: 16 },
  body: { padding: 16, paddingBottom: 120 },
  kindPill: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 12 },
  vocabImage: { width: "100%", height: 160, marginTop: 12 },
  speakBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  sayRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, marginTop: 12 },
  playBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 44, borderWidth: 2, marginTop: 12 },
  input: { backgroundColor: "transparent" },
  option: { padding: 16 },
  recordBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderWidth: 2 },
  result: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginTop: 16 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
});

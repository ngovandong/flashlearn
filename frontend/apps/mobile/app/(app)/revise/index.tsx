import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
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
import { AudioRecorder } from "@/utils/audio";
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

/** Selectable answer option row. */
function OptionRow({ label, onPress, disabled, t }: { label: string; onPress: () => void; disabled?: boolean; t: Tokens }) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[styles.option, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.md, opacity: disabled ? 0.6 : 1 }]}
    >
      <Text style={{ color: t.neutral.text, fontWeight: "600" }}>{label}</Text>
    </PressableScale>
  );
}

export default function MixedReviseScreen() {
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cards, setCards] = useState<ReviseCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<{ correct: boolean; answer?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const recorder = React.useRef(new AudioRecorder());
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    let active = true;
    reviseApi.buildSession(SESSION_SIZE).then((res) => {
      if (!active) return;
      try {
        const data = unwrap<{ cards: ReviseCard[] }>(res);
        setCards(data.cards ?? []);
      } catch {
        setCards([]);
      }
    });
    return () => { active = false; };
  }, []);

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

  const submit = useCallback(
    async (given: unknown, opts?: { audio?: string; mimeType?: string }) => {
      if (submitting || result || !card) return;
      setSubmitting(true);
      const res = opts?.audio
        ? await reviseApi.answerSpeaking(card.id, { audio: opts.audio, mimeType: opts.mimeType ?? "audio/m4a" })
        : await reviseApi.answer(card.id, given);
      setSubmitting(false);
      try {
        const data = unwrap<{ correct: boolean; answer?: string }>(res);
        setResult(data);
        if (data.correct) setScore((s) => s + 1);
      } catch {
        setResult({ correct: false });
      }
    },
    [submitting, result, card]
  );

  const advance = async () => {
    if (index + 1 >= total) {
      setDone(true);
      await userSettingsApi.recordStudyActivity();
    } else {
      setIndex((i) => i + 1);
      setResult(null);
      setTextValue("");
      setChosen(null);
    }
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
            <GradientButton label="Done" onPress={() => router.back()} style={styles.doneBtn} />
          </View>
        </FadeSlideIn>
      </View>
    );
  }

  const payload = card?.payload ?? {};
  const progress = total ? index / total : 0;

  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} hitSlop={8} style={[styles.iconBtn, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}>
          <MaterialIcons name="close" size={22} color={t.neutral.text} />
        </PressableScale>
        <Text variant="labelLarge" style={{ color: t.neutral.textMinor, fontWeight: "700" }}>
          {index + 1} / {total}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <AnimatedBar progress={progress} color={t.palette.primary} trackColor={t.neutral.surface2} style={styles.bar} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
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
            <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "700", marginTop: 12 }}>
              {card?.prompt ?? String(payload.prompt ?? payload.question ?? "")}
            </Text>

            <View style={{ marginTop: 16, gap: 10 }}>
              {card?.kind === "vocab" && Array.isArray(payload.options)
                ? (payload.options as string[]).map((opt) => (
                    <OptionRow key={opt} label={opt} disabled={!!result || submitting} onPress={() => { setChosen(opt); submit(opt); }} t={t} />
                  ))
                : null}

              {(card?.kind === "grammar" && !isChooseGrammar) || card?.kind === "listening" ? (
                <>
                  <TextInput mode="outlined" value={textValue} onChangeText={setTextValue} disabled={!!result} outlineStyle={{ borderRadius: t.radii.md }} style={styles.input} />
                  <GradientButton label="Submit" onPress={() => submit(textValue)} disabled={!!result || !textValue.trim()} />
                </>
              ) : null}

              {isChooseGrammar && Array.isArray(payload.options)
                ? (payload.options as string[]).map((opt) => (
                    <OptionRow key={opt} label={opt} disabled={!!result} onPress={() => submit(opt)} t={t} />
                  ))
                : null}

              {card?.kind === "speaking" ? (
                recording ? (
                  <GradientButton
                    label="Stop & submit"
                    icon="stop"
                    onPress={async () => {
                      const rec = await recorder.current.stop();
                      setRecording(false);
                      if (rec) submit("", { audio: rec.base64, mimeType: rec.mimeType });
                    }}
                    disabled={!!result}
                  />
                ) : (
                  <PressableScale
                    onPress={async () => { await recorder.current.start(); setRecording(true); }}
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
                  {result.correct ? "Correct!" : `Answer: ${result.answer ?? ""}`}
                </Text>
              </View>
            ) : null}
          </AppCard>
        </FadeSlideIn>
      </ScrollView>

      {result ? (
        <View style={[styles.footer, { backgroundColor: t.neutral.surface, borderTopColor: t.neutral.border, paddingBottom: insets.bottom + 72 }]}>
          <GradientButton label="Continue" icon="arrow-forward" onPress={advance} />
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  bar: { marginHorizontal: 16 },
  body: { padding: 16, paddingBottom: 120 },
  kindPill: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5 },
  input: { backgroundColor: "transparent" },
  option: { padding: 16 },
  recordBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderWidth: 2 },
  result: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginTop: 16 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
});

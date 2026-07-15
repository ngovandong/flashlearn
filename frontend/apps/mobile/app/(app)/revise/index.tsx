import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, IconButton, ProgressBar, Text, TextInput, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import type { ReviseCard } from "@flashlearn/core";
import { reviseApi, userSettingsApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { AudioRecorder } from "@/utils/audio";
import { unwrap } from "@/utils/apiError";

const SESSION_SIZE = 12;

export default function MixedReviseScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [cards, setCards] = useState<ReviseCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<{ correct: boolean; answer?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const recorder = React.useRef(new AudioRecorder());

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
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
          Session complete
        </Text>
        <Text variant="titleLarge" style={{ color: theme.colors.primary, marginTop: 8 }}>
          {score} / {total}
        </Text>
        <Button mode="contained" onPress={() => router.back()} style={{ marginTop: 24 }}>
          Done
        </Button>
      </View>
    );
  }

  const payload = card?.payload ?? {};

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <IconButton icon="close" onPress={() => router.back()} />
        <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          {index + 1} / {total}
        </Text>
        <View style={{ width: 48 }} />
      </View>
      <ProgressBar progress={total ? index / total : 0} style={{ marginHorizontal: 16 }} />

      <View style={styles.body}>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 12 }}>
          {card?.prompt ?? String(payload.prompt ?? payload.question ?? "")}
        </Text>

        {card?.kind === "vocab" && Array.isArray(payload.options) ? (
          (payload.options as string[]).map((opt) => (
            <Button
              key={opt}
              mode={chosen === opt ? "contained" : "outlined"}
              onPress={() => { setChosen(opt); submit(opt); }}
              disabled={!!result || submitting}
              style={{ marginBottom: 8 }}
            >
              {opt}
            </Button>
          ))
        ) : null}

        {(card?.kind === "grammar" && !isChooseGrammar) || card?.kind === "listening" ? (
          <>
            <TextInput mode="outlined" value={textValue} onChangeText={setTextValue} disabled={!!result} />
            <Button mode="contained" onPress={() => submit(textValue)} disabled={!!result || !textValue.trim()} style={{ marginTop: 8 }}>
              Submit
            </Button>
          </>
        ) : null}

        {isChooseGrammar && Array.isArray(payload.options) ? (
          (payload.options as string[]).map((opt) => (
            <Button key={opt} mode="outlined" onPress={() => submit(opt)} disabled={!!result} style={{ marginBottom: 8 }}>
              {opt}
            </Button>
          ))
        ) : null}

        {card?.kind === "speaking" ? (
          <View style={styles.row}>
            <Button mode="outlined" onPress={() => recorder.current.start()} disabled={!!result}>
              Record
            </Button>
            <Button
              mode="contained"
              onPress={async () => {
                const rec = await recorder.current.stop();
                if (rec) submit("", { audio: rec.base64, mimeType: rec.mimeType });
              }}
              disabled={!!result}
            >
              Stop & submit
            </Button>
          </View>
        ) : null}

        {result ? (
          <Text style={{ color: result.correct ? "#2e7d32" : theme.colors.error, marginTop: 16, textAlign: "center" }}>
            {result.correct ? "Correct!" : `Answer: ${result.answer ?? ""}`}
          </Text>
        ) : null}
      </View>

      {result ? (
        <Button mode="contained" onPress={advance} style={{ margin: 16 }}>
          Continue
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  body: { flex: 1, padding: 16 },
  row: { flexDirection: "row", gap: 10, marginTop: 12 },
});

import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Divider, List, SegmentedButtons, Text, TextInput, useTheme } from "react-native-paper";
import type { MD3Theme } from "react-native-paper";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { WritingSession } from "@flashlearn/core";
import { writingApi } from "@/api/services";
import { unwrap } from "@/utils/apiError";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const SUCCESS_GREEN = "#2e7d32";

const BAND_LABELS: Record<string, string> = {
  taskResponse: "Task Response",
  coherence: "Coherence",
  lexical: "Lexical",
  grammar: "Grammar",
};

interface Correction {
  type?: string;
  text?: string;
  suggestion?: string;
  issue?: string;
}

interface WritingFeedback {
  overallBand?: number;
  bands?: Record<string, number>;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  corrections?: Correction[];
  improvedVersion?: string;
}

const fmtBand = (n?: number) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? `${v}` : v.toFixed(1);
};

export default function WritingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<"chat" | "free">("chat");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("B1");
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);

  const startChatMutation = useMutation({
    mutationFn: async () => {
      const res = await writingApi.startChat({ topic, level, tone: "casual" });
      return unwrap<{ id: string }>(res);
    },
    onSuccess: (data) => router.push(`/writing/${data.id}`),
  });

  const submitDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await writingApi.submitDraft({ topic, draft, level, tone: "casual" });
      return unwrap<WritingSession>(res);
    },
    onSuccess: (session) => setFeedback((session.feedback as WritingFeedback) ?? {}),
  });

  const historyQuery = useQuery({
    queryKey: ["writing", "history"],
    queryFn: async () => unwrap<{ sessions: { id: string; topic?: string }[] }>(await writingApi.getHistory()),
  });

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }}>
      <View style={styles.pad}>
        <SegmentedButtons
          value={mode}
          onValueChange={(v) => setMode(v as "chat" | "free")}
          buttons={[
            { value: "chat", label: "Chat" },
            { value: "free", label: "Free-form" },
          ]}
        />
        <TextInput label="Topic" mode="outlined" value={topic} onChangeText={setTopic} style={{ marginTop: 12 }} />
        <View style={styles.levelRow}>
          {LEVELS.map((l) => (
            <Button key={l} mode={level === l ? "contained" : "outlined"} compact onPress={() => setLevel(l)}>
              {l}
            </Button>
          ))}
        </View>

        {mode === "chat" ? (
          <Button
            mode="contained"
            onPress={() => startChatMutation.mutate()}
            loading={startChatMutation.isPending}
            disabled={!topic.trim()}
            style={{ marginTop: 16 }}
          >
            Start chat
          </Button>
        ) : (
          <>
            <TextInput
              label="Your draft"
              mode="outlined"
              value={draft}
              onChangeText={setDraft}
              multiline
              numberOfLines={6}
              style={{ marginTop: 16 }}
            />
            <Button
              mode="contained"
              onPress={() => submitDraftMutation.mutate()}
              loading={submitDraftMutation.isPending}
              disabled={!topic.trim() || !draft.trim()}
              style={{ marginTop: 12 }}
            >
              Get feedback
            </Button>
            {feedback ? <FeedbackReport feedback={feedback} theme={theme} /> : null}
          </>
        )}
      </View>

      {(historyQuery.data?.sessions ?? []).slice(0, 5).map((s: { id: string; topic?: string }) => (
        <List.Item
          key={s.id}
          title={s.topic ?? "Writing session"}
          onPress={() => router.push(`/writing/${s.id}`)}
          right={() => <List.Icon icon="chevron-right" />}
        />
      ))}
    </ScrollView>
  );
}

function FeedbackReport({
  feedback,
  theme,
}: {
  feedback: WritingFeedback;
  theme: MD3Theme;
}) {
  const bands = feedback.bands ?? {};
  const strengths = feedback.strengths ?? [];
  const improvements = feedback.improvements ?? [];
  const corrections = feedback.corrections ?? [];

  return (
    <View style={[styles.report, { backgroundColor: theme.colors.surfaceVariant }]}>
      <View style={styles.overallRow}>
        <View>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Overall band
          </Text>
          <Text variant="displaySmall" style={{ color: theme.colors.primary, fontWeight: "700" }}>
            {fmtBand(feedback.overallBand)}
            <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {" "}/ 9.0
            </Text>
          </Text>
        </View>
      </View>

      <View style={styles.bandGrid}>
        {Object.keys(BAND_LABELS).map((key) => (
          <View key={key} style={[styles.bandCard, { backgroundColor: theme.colors.surface }]}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: "700" }}>
              {fmtBand(bands[key])}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
              {BAND_LABELS[key]}
            </Text>
          </View>
        ))}
      </View>

      {feedback.summary ? (
        <>
          <Divider style={styles.reportDivider} />
          <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
            Examiner summary
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
            {feedback.summary}
          </Text>
        </>
      ) : null}

      {strengths.length > 0 ? (
        <>
          <Text variant="labelLarge" style={{ color: SUCCESS_GREEN, marginTop: 12 }}>
            Strengths
          </Text>
          {strengths.map((s, i) => (
            <Text key={i} variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
              • {s}
            </Text>
          ))}
        </>
      ) : null}

      {improvements.length > 0 ? (
        <>
          <Text variant="labelLarge" style={{ color: "#ed6c02", marginTop: 12 }}>
            To improve
          </Text>
          {improvements.map((s, i) => (
            <Text key={i} variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
              • {s}
            </Text>
          ))}
        </>
      ) : null}

      {corrections.length > 0 ? (
        <>
          <Divider style={styles.reportDivider} />
          <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
            Corrections
          </Text>
          {corrections.map((c, i) => (
            <View key={i} style={styles.correction}>
              <Text variant="bodyMedium">
                <Text style={{ color: theme.colors.error, textDecorationLine: "line-through" }}>
                  {c.text}
                </Text>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>{"  →  "}</Text>
                <Text style={{ color: SUCCESS_GREEN, fontWeight: "600" }}>{c.suggestion}</Text>
              </Text>
              {c.issue ? (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                  {c.issue}
                </Text>
              ) : null}
            </View>
          ))}
        </>
      ) : null}

      {feedback.improvedVersion ? (
        <>
          <Divider style={styles.reportDivider} />
          <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
            Model rewrite
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4, fontStyle: "italic" }}>
            {feedback.improvedVersion}
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16 },
  levelRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  report: { marginTop: 16, padding: 16, borderRadius: 12 },
  overallRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bandGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  bandCard: {
    flexGrow: 1,
    flexBasis: "22%",
    minWidth: 70,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  reportDivider: { marginVertical: 12 },
  correction: { marginTop: 8 },
});

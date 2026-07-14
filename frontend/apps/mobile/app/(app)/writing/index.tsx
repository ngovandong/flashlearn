import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, List, SegmentedButtons, Text, TextInput, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { writingApi } from "@/api/services";
import { unwrap } from "@/utils/apiError";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function WritingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<"chat" | "free">("chat");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("B1");
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

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
      return unwrap(res);
    },
    onSuccess: (res) => setFeedback(JSON.stringify(res)),
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
            {feedback ? (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                {feedback}
              </Text>
            ) : null}
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

const styles = StyleSheet.create({
  pad: { padding: 16 },
  levelRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
});

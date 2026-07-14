import React, { useState } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { Button, List, Text, TextInput, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { speakingApi } from "@/api/services";
import { LoadingView } from "@/components/LoadingView";
import { unwrap } from "@/utils/apiError";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function SpeakingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("B1");

  const voicesQuery = useQuery({
    queryKey: ["speaking", "voices"],
    queryFn: async () => unwrap(await speakingApi.getVoices()),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await speakingApi.generateConversation({ topic, level, tone: "casual" });
      return unwrap<{ id: string }>(res);
    },
    onSuccess: (data) => router.push(`/speaking/${data.id}`),
  });

  const historyQuery = useQuery({
    queryKey: ["speaking", "history"],
    queryFn: async () => unwrap<{ conversations: { id: string; topic?: string }[] }>(await speakingApi.getHistory()),
  });

  if (voicesQuery.isLoading) return <LoadingView />;

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }}>
      <View style={styles.pad}>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
          Start a conversation
        </Text>
        <TextInput label="Topic" mode="outlined" value={topic} onChangeText={setTopic} style={{ marginTop: 12 }} />
        <View style={styles.levelRow}>
          {LEVELS.map((l) => (
            <Button key={l} mode={level === l ? "contained" : "outlined"} compact onPress={() => setLevel(l)}>
              {l}
            </Button>
          ))}
        </View>
        <Button
          mode="contained"
          onPress={() => generateMutation.mutate()}
          loading={generateMutation.isPending}
          disabled={!topic.trim() || generateMutation.isPending}
          style={{ marginTop: 12 }}
        >
          Generate
        </Button>
        <Button mode="text" onPress={() => router.push("/speaking/history")} style={{ marginTop: 8 }}>
          View history
        </Button>
      </View>

      {(historyQuery.data?.conversations ?? []).slice(0, 5).map((c: { id: string; topic?: string }) => (
        <List.Item
          key={c.id}
          title={c.topic ?? "Conversation"}
          onPress={() => router.push(`/speaking/${c.id}`)}
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

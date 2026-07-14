import React, { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Button, Text, TextInput, useTheme } from "react-native-paper";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { WritingSession } from "@flashlearn/core";
import { writingApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { unwrap } from "@/utils/apiError";

export default function WritingSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [input, setInput] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["writing", id],
    queryFn: async () => unwrap<WritingSession>(await writingApi.getSession(id!)),
    enabled: !!id,
  });

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await writingApi.sendMessage(id!, text);
      return unwrap(res);
    },
    onSuccess: () => {
      setInput("");
      refetch();
    },
  });

  if (isLoading) return <LoadingView />;
  if (isError || !data) return <ErrorView message="Could not load session" onRetry={() => refetch()} />;

  const messages = data.messages ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Text variant="titleLarge" style={{ color: theme.colors.onSurface, padding: 16 }}>
        {data.topic}
      </Text>
      <FlatList
        data={messages}
        keyExtractor={(item, idx) => item.id ?? String(idx)}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              {
                backgroundColor:
                  item.role === "user" ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
                alignSelf: item.role === "user" ? "flex-end" : "flex-start",
              },
            ]}
          >
            <Text style={{ color: theme.colors.onSurface }}>{item.text}</Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          mode="outlined"
          value={input}
          onChangeText={setInput}
          placeholder="Reply…"
          style={{ flex: 1 }}
        />
        <Button mode="contained" onPress={() => sendMutation.mutate(input)} disabled={!input.trim()} loading={sendMutation.isPending}>
          Send
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bubble: { maxWidth: "85%", padding: 12, borderRadius: 12 },
  inputRow: { flexDirection: "row", gap: 8, padding: 12, alignItems: "center" },
});

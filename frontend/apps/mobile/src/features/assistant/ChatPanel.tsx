import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Button, Chip, Text, TextInput, IconButton, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { mapReminderRoute } from "@flashlearn/core";
import type { AssistantAction } from "@flashlearn/api";
import { assistantApi } from "@/api/services";
import { unwrap } from "@/utils/apiError";
import { ERROR_REPLY, WELCOME_TEXT } from "@/features/assistant/constants";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  actions?: AssistantAction[];
  suggestions?: string[];
}

let counter = 0;
const nextId = () => (counter += 1);

const toHistory = (messages: Message[]) =>
  messages.filter((m) => m.text).map((m) => ({ role: m.role, text: m.text }));

export function ChatPanel() {
  const theme = useTheme();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    { id: nextId(), role: "assistant", text: WELCOME_TEXT },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || typing) return;
    const history = toHistory(messages);
    setMessages((prev) => [...prev, { id: nextId(), role: "user", text }]);
    setInput("");
    setTyping(true);
    try {
      const data = unwrap<{ reply?: string; actions?: AssistantAction[]; suggestions?: string[] }>(
        await assistantApi.chat({ message: text, history, page: "/" })
      );
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          text: data.reply || ERROR_REPLY,
          actions: Array.isArray(data.actions) ? data.actions : [],
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", text: ERROR_REPLY },
      ]);
    } finally {
      setTyping(false);
    }
  };

  const runAction = (action: AssistantAction) => {
    // Native has no in-app tour system, so only navigation actions are actionable.
    if (action.type !== "navigate" || !action.route) return;
    const nativePath = mapReminderRoute(action.route);
    if (nativePath) router.push(nativePath as never);
  };

  return (
    <View style={styles.container}>
      <View style={styles.messages}>
        {messages.map((m) => {
          const isUser = m.role === "user";
          const navActions = (m.actions ?? []).filter(
            (a) => a.type === "navigate" && a.route && mapReminderRoute(a.route)
          );
          return (
            <View key={m.id} style={{ gap: 8 }}>
              <View
                style={[
                  styles.bubble,
                  {
                    alignSelf: isUser ? "flex-end" : "flex-start",
                    backgroundColor: isUser ? theme.colors.primary : theme.colors.surfaceVariant,
                  },
                ]}
              >
                <Text style={{ color: isUser ? theme.colors.onPrimary : theme.colors.onSurface }}>
                  {m.text}
                </Text>
              </View>

              {navActions.map((action, i) => (
                <Button
                  key={`${m.id}-a-${i}`}
                  mode="contained-tonal"
                  compact
                  icon="arrow-right"
                  style={styles.action}
                  onPress={() => runAction(action)}
                >
                  {action.label}
                </Button>
              ))}

              {(m.suggestions ?? []).length > 0 ? (
                <View style={styles.suggestions}>
                  {m.suggestions!.map((s, i) => (
                    <Chip key={`${m.id}-s-${i}`} compact onPress={() => send(s)} style={styles.chip}>
                      {s}
                    </Chip>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
        {typing && (
          <View
            style={[
              styles.bubble,
              { alignSelf: "flex-start", backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <Text style={{ color: theme.colors.onSurfaceVariant }}>…</Text>
          </View>
        )}
      </View>

      <View style={styles.composer}>
        <TextInput
          mode="outlined"
          dense
          style={styles.input}
          placeholder="Message Dragon…"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send()}
          returnKeyType="send"
        />
        <IconButton
          icon="send"
          mode="contained"
          disabled={!input.trim() || typing}
          onPress={() => send()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  messages: { gap: 10 },
  bubble: {
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  action: { alignSelf: "flex-start" },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { marginRight: 0 },
  composer: { flexDirection: "row", alignItems: "center", gap: 4 },
  input: { flex: 1 },
});

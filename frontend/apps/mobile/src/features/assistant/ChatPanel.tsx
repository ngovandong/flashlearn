import React, { useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Text, TextInput, IconButton, useTheme } from "react-native-paper";
import {
  STUB_REPLY,
  STUB_REPLY_DELAY_MS,
  WELCOME_TEXT,
} from "@/features/assistant/constants";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

let counter = 0;
const nextId = () => (counter += 1);

export function ChatPanel() {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([
    { id: nextId(), role: "assistant", text: WELCOME_TEXT },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = () => {
    const text = input.trim();
    if (!text || typing) return;
    setMessages((prev) => [...prev, { id: nextId(), role: "user", text }]);
    setInput("");
    setTyping(true);
    timer.current = setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", text: STUB_REPLY },
      ]);
    }, STUB_REPLY_DELAY_MS);
  };

  return (
    <View style={styles.container}>
      <View style={styles.messages}>
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <View
              key={m.id}
              style={[
                styles.bubble,
                {
                  alignSelf: isUser ? "flex-end" : "flex-start",
                  backgroundColor: isUser
                    ? theme.colors.primary
                    : theme.colors.surfaceVariant,
                },
              ]}
            >
              <Text
                style={{
                  color: isUser ? theme.colors.onPrimary : theme.colors.onSurface,
                }}
              >
                {m.text}
              </Text>
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
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <IconButton
          icon="send"
          mode="contained"
          disabled={!input.trim() || typing}
          onPress={send}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  messages: { gap: 8 },
  bubble: {
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  composer: { flexDirection: "row", alignItems: "center", gap: 4 },
  input: { flex: 1 },
});

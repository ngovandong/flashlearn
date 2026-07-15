import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Avatar, IconButton, Text, TextInput, useTheme } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { mapReminderRoute, REMINDER_META } from "@flashlearn/core";
import type { AssistantAction } from "@flashlearn/api";
import { useAppSelector } from "@/store/hooks";
import { selectUser } from "@/store/authSlice";
import { useReminders } from "@/features/home/hooks";
import { reminderIconName } from "@/theme/reminderIcons";
import { assistantApi } from "@/api/services";
import { unwrap } from "@/utils/apiError";
import { ASSISTANT_NAME, ERROR_REPLY, WELCOME_TEXT } from "@/features/assistant/constants";
import { DragonAvatar } from "@/features/assistant/DragonAvatar";
import { TypingDots } from "@/features/assistant/TypingDots";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  actions?: AssistantAction[];
  suggestions?: string[];
  showShortcuts?: boolean;
}

let counter = 0;
const nextId = () => (counter += 1);

const toHistory = (messages: Message[]) =>
  messages.filter((m) => m.text).map((m) => ({ role: m.role, text: m.text }));

export function ChatPanel({ onClose }: { onClose?: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const { data: reminders } = useReminders();
  const reminderShortcuts = (reminders ?? []).filter((r) => REMINDER_META[r.type]);
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([
    { id: nextId(), role: "assistant", text: WELCOME_TEXT, showShortcuts: true },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);

  const scrollToEnd = () => scrollRef.current?.scrollToEnd({ animated: true });

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
      setMessages((prev) => [...prev, { id: nextId(), role: "assistant", text: ERROR_REPLY }]);
    } finally {
      setTyping(false);
    }
  };

  const runAction = (action: AssistantAction) => {
    // Native has no in-app tour system, so only navigation actions are actionable.
    if (action.type !== "navigate" || !action.route) return;
    const nativePath = mapReminderRoute(action.route);
    if (nativePath) {
      onClose?.();
      router.push(nativePath as never);
    }
  };

  const goToReminder = (route: string) => {
    const nativePath = mapReminderRoute(route);
    if (nativePath) {
      onClose?.();
      router.push(nativePath as never);
    }
  };

  const initial = (user?.name || user?.first_name || "Y").charAt(0).toUpperCase();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
        <DragonAvatar size={40} idleAnimation />
        <View style={styles.headerText}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: "800" }}>
            {ASSISTANT_NAME}
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              AI study buddy
            </Text>
          </View>
        </View>
        <IconButton icon="close" size={22} onPress={onClose} accessibilityLabel="Close chat" />
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={[styles.flex, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.messages}
        onContentSizeChange={scrollToEnd}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((m) => {
          const isUser = m.role === "user";
          const navActions = (m.actions ?? []).filter(
            (a) => a.type === "navigate" && a.route && mapReminderRoute(a.route)
          );
          return (
            <View key={m.id} style={styles.messageBlock}>
              <View style={[styles.bubbleRow, { justifyContent: isUser ? "flex-end" : "flex-start" }]}>
                {!isUser && <DragonAvatar size={26} />}
                <View
                  style={[
                    styles.bubble,
                    isUser
                      ? { backgroundColor: theme.colors.primary, borderBottomRightRadius: 4 }
                      : { backgroundColor: theme.colors.surfaceVariant, borderBottomLeftRadius: 4 },
                  ]}
                >
                  <Text style={{ color: isUser ? theme.colors.onPrimary : theme.colors.onSurface, lineHeight: 20 }}>
                    {m.text}
                  </Text>
                </View>
                {isUser &&
                  (user?.image_url ? (
                    <Avatar.Image size={26} source={{ uri: user.image_url }} />
                  ) : (
                    <Avatar.Text
                      size={26}
                      label={initial}
                      labelStyle={{ fontSize: 12 }}
                      style={{ backgroundColor: theme.colors.primary }}
                    />
                  ))}
              </View>

              {(navActions.length > 0 || (m.suggestions?.length ?? 0) > 0 || m.showShortcuts) && (
                <View style={styles.extras}>
                  {navActions.map((action, i) => (
                    <Pressable
                      key={`${m.id}-a-${i}`}
                      onPress={() => runAction(action)}
                      style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
                    >
                      <MaterialIcons name="auto-awesome" size={16} color={theme.colors.onPrimary} />
                      <Text style={{ color: theme.colors.onPrimary, fontWeight: "700" }}>{action.label}</Text>
                    </Pressable>
                  ))}

                  {(m.suggestions?.length ?? 0) > 0 && (
                    <View style={styles.chips}>
                      {m.suggestions!.map((s, i) => (
                        <Pressable
                          key={`${m.id}-s-${i}`}
                          onPress={() => send(s)}
                          style={[styles.chip, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant }]}
                        >
                          <Text style={{ color: theme.colors.onSurface }}>{s}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {m.showShortcuts && reminderShortcuts.length > 0 && (
                    <>
                      <Text variant="labelSmall" style={[styles.shortcutLabel, { color: theme.colors.onSurfaceVariant }]}>
                        OR JUMP BACK IN
                      </Text>
                      <View style={styles.chips}>
                        {reminderShortcuts.map((reminder) => {
                          const meta = REMINDER_META[reminder.type];
                          return (
                            <Pressable
                              key={reminder.type}
                              onPress={() => goToReminder(reminder.route)}
                              style={[styles.chip, styles.reminderChip, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant }]}
                            >
                              <MaterialIcons
                                name={reminderIconName(meta.icon) as never}
                                size={16}
                                color={theme.colors.primary}
                              />
                              <Text style={{ color: theme.colors.onSurface }}>{meta.title}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {typing && (
          <View style={[styles.bubbleRow, { justifyContent: "flex-start" }]}>
            <DragonAvatar size={26} />
            <View style={[styles.bubble, { backgroundColor: theme.colors.surfaceVariant, borderBottomLeftRadius: 4 }]}>
              <TypingDots />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Composer */}
      <View style={[styles.composer, { borderTopColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }]}>
        <TextInput
          mode="outlined"
          dense
          multiline
          style={styles.input}
          placeholder={`Message ${ASSISTANT_NAME}…`}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send()}
          returnKeyType="send"
          blurOnSubmit
        />
        <IconButton
          icon="send"
          mode="contained"
          disabled={!input.trim() || typing}
          onPress={() => send()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, minWidth: 0 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#2fbf71" },
  messages: { padding: 16, gap: 14 },
  messageBlock: { gap: 8 },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  extras: { paddingLeft: 32, gap: 8 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reminderChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  shortcutLabel: { letterSpacing: 0.5, marginTop: 2 },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, maxHeight: 96 },
});

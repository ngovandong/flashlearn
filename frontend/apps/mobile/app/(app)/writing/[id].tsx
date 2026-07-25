import React, { useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text, TextInput } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { WritingMessage, WritingSession } from "@flashlearn/core";
import { writingApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { GradientSurface } from "@/components/ui/GradientSurface";
import { PressableScale } from "@/components/PressableScale";
import { unwrap } from "@/utils/apiError";
import { useTokens } from "@/theme/tokens";

export default function WritingSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTokens();
  const insets = useSafeAreaInsets();
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
  const canSend = input.trim().length > 0 && !sendMutation.isPending;

  const renderBubble = ({ item }: { item: WritingMessage }) => {
    const isMe = item.role === "user";
    if (isMe) {
      return (
        <View style={{ alignItems: "flex-end" }}>
          <GradientSurface style={[styles.bubble, styles.meBubble, { borderRadius: t.radii.lg }]}>
            <Text style={styles.meText}>{item.text}</Text>
          </GradientSurface>
        </View>
      );
    }
    return (
      <View style={{ alignItems: "flex-start" }}>
        <Text
          variant="labelSmall"
          style={{ color: t.neutral.textMuted, fontWeight: "800", letterSpacing: 0.6, marginBottom: 4, marginLeft: 6 }}
        >
          COACH
        </Text>
        <View
          style={[
            styles.bubble,
            styles.coachBubble,
            { backgroundColor: t.neutral.surface, borderColor: t.neutral.border, borderRadius: t.radii.lg },
            t.shadow,
          ]}
        >
          <Text style={{ color: t.neutral.text, fontSize: 15, lineHeight: 22 }}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: t.neutral.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={[styles.header, { borderBottomColor: t.neutral.border }]}>
        <FeatureTile icon="edit-note" size={40} variant="solid" />
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium" numberOfLines={1} style={{ color: t.neutral.text, fontWeight: "800" }}>
            {data.topic ?? "Writing session"}
          </Text>
          {data.level || data.tone ? (
            <Text variant="bodySmall" style={{ color: t.neutral.textMinor }}>
              {[data.level, data.tone].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item, idx) => item.id ?? String(idx)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={renderBubble}
      />

      <View style={[styles.inputBar, { backgroundColor: t.neutral.surface, borderTopColor: t.neutral.border, paddingBottom: insets.bottom + 68 }]}>
        <TextInput
          mode="outlined"
          value={input}
          onChangeText={setInput}
          placeholder="Write your reply…"
          multiline
          style={styles.input}
          outlineStyle={{ borderRadius: t.radii.lg }}
        />
        <PressableScale
          onPress={() => canSend && sendMutation.mutate(input)}
          disabled={!canSend}
          style={[
            styles.sendBtn,
            { backgroundColor: canSend ? t.palette.primary : t.neutral.surface2, borderRadius: t.radii.pill },
          ]}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator size="small" color={t.palette.onPrimary} />
          ) : (
            <MaterialIcons name="send" size={20} color={canSend ? t.palette.onPrimary : t.neutral.textMuted} />
          )}
        </PressableScale>
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
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  list: { padding: 16, gap: 14, paddingBottom: 24 },
  bubble: { padding: 14, maxWidth: "88%" },
  meBubble: { overflow: "hidden" },
  coachBubble: { borderWidth: 1 },
  meText: { color: "#ffffff", fontSize: 15, lineHeight: 22, fontWeight: "600" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, maxHeight: 120, backgroundColor: "transparent" },
  sendBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginBottom: 4 },
});

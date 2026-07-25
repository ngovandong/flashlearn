import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { DeckDetail, DeckUserRole } from "@flashlearn/core";
import { deckApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { AppCard } from "@/components/ui/AppCard";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { GradientButton } from "@/components/ui/GradientButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens, type Tokens } from "@/theme/tokens";

function RolePill({ label, active, onPress, t }: { label: string; active: boolean; onPress: () => void; t: Tokens }) {
  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.pill,
        { backgroundColor: active ? t.palette.primary : t.neutral.surface2, borderRadius: t.radii.pill },
      ]}
    >
      <Text style={{ color: active ? t.palette.onPrimary : t.neutral.textMinor, fontWeight: active ? "800" : "600" }}>
        {label}
      </Text>
    </PressableScale>
  );
}

export default function ShareDeckScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const t = useTokens();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"E" | "V">("V");
  const [message, setMessage] = useState<string | null>(null);

  const deckQuery = useQuery({
    queryKey: queryKeys.decks.detail(deckId!),
    queryFn: async () => unwrap<DeckDetail>(await deckApi.retrieve(deckId!)),
    enabled: !!deckId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await deckApi.addUserToDeck(deckId!, { email, role });
      return unwrap(res);
    },
    onSuccess: () => {
      setMessage("User added to deck.");
      setEmail("");
      deckQuery.refetch();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (userEmail: string) => deckApi.removeUserFromDeck(deckId!, userEmail),
    onSuccess: () => deckQuery.refetch(),
  });

  if (deckQuery.isLoading) return <LoadingView />;
  if (deckQuery.isError || !deckQuery.data) return <ErrorView message="Could not load deck" onRetry={() => deckQuery.refetch()} />;

  const deck = deckQuery.data;

  return (
    <ScrollView style={{ backgroundColor: t.neutral.bg }} contentContainerStyle={styles.pad}>
      <FadeSlideIn>
        <AppCard>
          <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800" }}>
            Invite by email
          </Text>
          <TextInput
            label="Email"
            mode="outlined"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            outlineStyle={{ borderRadius: t.radii.md }}
            style={[styles.input, { marginTop: 12 }]}
          />
          <Text variant="bodySmall" style={{ color: t.neutral.textMinor, fontWeight: "700", marginTop: 14, marginBottom: 8 }}>
            Permission
          </Text>
          <View style={styles.row}>
            <RolePill label="Can view" active={role === "V"} onPress={() => setRole("V")} t={t} />
            <RolePill label="Can edit" active={role === "E"} onPress={() => setRole("E")} t={t} />
          </View>
          <GradientButton
            label="Add user"
            icon="person-add"
            onPress={() => addMutation.mutate()}
            disabled={!email.trim() || addMutation.isPending}
            loading={addMutation.isPending}
            style={{ marginTop: 16 }}
          />
          {message ? (
            <Text style={{ color: t.neutral.textMinor, marginTop: 10, textAlign: "center" }}>{message}</Text>
          ) : null}
        </AppCard>
      </FadeSlideIn>

      <FadeSlideIn delay={80} style={{ marginTop: 20 }}>
        <SectionHeader title="Current members" />
        <View style={{ gap: 10, marginTop: 12 }}>
          {(deck.user_roles ?? []).map((ur: DeckUserRole) => (
            <AppCard key={ur.user.email} padding={14}>
              <View style={styles.memberRow}>
                <FeatureTile icon={ur.role === "O" ? "emoji-events" : ur.role === "E" ? "edit-note" : "menu-book"} size={42} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: t.neutral.text, fontWeight: "700" }}>
                    {ur.user.email}
                  </Text>
                  <Text variant="bodySmall" style={{ color: t.neutral.textMinor }}>
                    {ur.role === "O" ? "Owner" : ur.role === "E" ? "Can edit" : "Can view"}
                  </Text>
                </View>
                {ur.role !== "O" ? (
                  <PressableScale onPress={() => removeMutation.mutate(ur.user.email)} hitSlop={8} style={styles.removeBtn}>
                    <MaterialIcons name="close" size={20} color={t.neutral.textMuted} />
                  </PressableScale>
                ) : null}
              </View>
            </AppCard>
          ))}
        </View>
      </FadeSlideIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  input: { backgroundColor: "transparent" },
  row: { flexDirection: "row", gap: 10 },
  pill: { flex: 1, alignItems: "center", paddingVertical: 12 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  removeBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
});

import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Text, TextInput, useTheme } from "react-native-paper";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { DeckDetail, DeckUserRole } from "@flashlearn/core";
import { deckApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";

export default function ShareDeckScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const theme = useTheme();
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
    <ScrollView contentContainerStyle={[styles.pad, { backgroundColor: theme.colors.background }]}>
      <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
        Invite by email
      </Text>
      <TextInput label="Email" mode="outlined" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <View style={styles.row}>
        <Button mode={role === "V" ? "contained" : "outlined"} onPress={() => setRole("V")} compact>
          View
        </Button>
        <Button mode={role === "E" ? "contained" : "outlined"} onPress={() => setRole("E")} compact>
          Edit
        </Button>
      </View>
      <Button mode="contained" onPress={() => addMutation.mutate()} disabled={!email.trim() || addMutation.isPending} loading={addMutation.isPending}>
        Add user
      </Button>
      {message ? <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>{message}</Text> : null}

      <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: 24 }}>
        Current members
      </Text>
      {(deck.user_roles ?? []).map((ur: DeckUserRole) => (
        <View key={ur.user.email} style={[styles.member, { borderColor: theme.colors.outlineVariant }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.onSurface }}>{ur.user.email}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {ur.role === "O" ? "Owner" : ur.role === "E" ? "Edit" : "View"}
            </Text>
          </View>
          {ur.role !== "O" ? (
            <Button mode="text" textColor={theme.colors.error} onPress={() => removeMutation.mutate(ur.user.email)}>
              Remove
            </Button>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, gap: 8 },
  row: { flexDirection: "row", gap: 8, marginVertical: 8 },
  member: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
});

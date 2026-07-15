import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Switch, Text, TextInput, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { deckApi } from "@/api/services";
import { unwrap } from "@/utils/apiError";

export default function CreateDeckScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await deckApi.create({ name, description, is_public: isPublic });
      return unwrap(res);
    },
    onSuccess: (deck) => {
      router.replace(`/library/${deck.id}/edit`);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <ScrollView contentContainerStyle={[styles.pad, { backgroundColor: theme.colors.background }]}>
      <TextInput label="Deck name" mode="outlined" value={name} onChangeText={setName} />
      <TextInput
        label="Description"
        mode="outlined"
        value={description}
        onChangeText={setDescription}
        multiline
        style={{ marginTop: 12 }}
      />
      <View style={styles.row}>
        <Text style={{ color: theme.colors.onSurface }}>Public deck</Text>
        <Switch value={isPublic} onValueChange={setIsPublic} />
      </View>
      {error ? <Text style={{ color: theme.colors.error }}>{error}</Text> : null}
      <Button
        mode="contained"
        onPress={() => mutation.mutate()}
        loading={mutation.isPending}
        disabled={!name.trim() || mutation.isPending}
        style={{ marginTop: 16 }}
      >
        Create deck
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
});

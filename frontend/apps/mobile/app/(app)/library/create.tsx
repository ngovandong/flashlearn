import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Switch, Text, TextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { deckApi } from "@/api/services";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { AppCard } from "@/components/ui/AppCard";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { GradientButton } from "@/components/ui/GradientButton";
import { unwrap } from "@/utils/apiError";
import { useTokens } from "@/theme/tokens";

export default function CreateDeckScreen() {
  const t = useTokens();
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
    <ScrollView style={{ backgroundColor: t.neutral.bg }} contentContainerStyle={styles.pad}>
      <FadeSlideIn>
        <View style={styles.brandRow}>
          <FeatureTile icon="style" size={46} variant="solid" />
          <View style={{ flex: 1 }}>
            <Text variant="headlineSmall" style={{ color: t.neutral.text, fontWeight: "800" }}>
              New deck
            </Text>
            <Text variant="bodySmall" style={{ color: t.neutral.textMinor }}>
              Give your flashcard set a name to get started.
            </Text>
          </View>
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={60}>
        <AppCard style={{ marginTop: 18 }}>
          <TextInput
            label="Deck name"
            mode="outlined"
            value={name}
            onChangeText={setName}
            outlineStyle={{ borderRadius: t.radii.md }}
            style={styles.input}
          />
          <TextInput
            label="Description"
            mode="outlined"
            value={description}
            onChangeText={setDescription}
            multiline
            outlineStyle={{ borderRadius: t.radii.md }}
            style={[styles.input, { marginTop: 12 }]}
          />
          <View style={[styles.row, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.md }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.neutral.text, fontWeight: "700" }}>Public deck</Text>
              <Text variant="bodySmall" style={{ color: t.neutral.textMinor }}>
                Anyone can discover and copy it.
              </Text>
            </View>
            <Switch value={isPublic} onValueChange={setIsPublic} color={t.palette.primary} />
          </View>
          {error ? (
            <Text style={{ color: t.mode === "dark" ? "#f87171" : "#d32f2f", marginTop: 8 }}>{error}</Text>
          ) : null}
          <GradientButton
            label="Create deck"
            onPress={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!name.trim() || mutation.isPending}
            style={{ marginTop: 18 }}
          />
        </AppCard>
      </FadeSlideIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  input: { backgroundColor: "transparent" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    marginTop: 14,
    gap: 12,
  },
});

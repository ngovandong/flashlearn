import React, { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Button, IconButton, Text, TextInput, useTheme } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeckDetail, Term } from "@flashlearn/core";
import { deckApi, imageApi, termApi, translateApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";

interface DraftTerm {
  name: string;
  meaning: string;
  image: string;
}

export default function EditDeckScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<DraftTerm>({ name: "", meaning: "", image: "" });
  const [terms, setTerms] = useState<Term[]>([]);

  const deckQuery = useQuery({
    queryKey: queryKeys.decks.detail(deckId!),
    queryFn: async () => unwrap<DeckDetail>(await deckApi.retrieve(deckId!)),
    enabled: !!deckId,
  });

  const termsQuery = useQuery({
    queryKey: queryKeys.terms.byDeck(deckId!, 1),
    queryFn: async () => unwrap<{ results: Term[] }>(await termApi.getTermsByDeck(deckId!, 1)),
    enabled: !!deckId,
  });

  React.useEffect(() => {
    if (termsQuery.data?.results) setTerms(termsQuery.data.results);
  }, [termsQuery.data]);

  const addMutation = useMutation({
    mutationFn: async () => {
      await termApi.addTermsToDeck(deckId!, [{ ...draft }]);
    },
    onSuccess: () => {
      setDraft({ name: "", meaning: "", image: "" });
      termsQuery.refetch();
      qc.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId!) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => termApi.delete(id),
    onSuccess: () => {
      termsQuery.refetch();
      qc.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId!) });
    },
  });

  const translate = async () => {
    if (!draft.name.trim()) return;
    const res = await translateApi.translate(draft.name);
    const data = unwrap<{ translation?: string }>(res);
    if (data.translation) setDraft((d) => ({ ...d, meaning: data.translation! }));
  };

  const searchImage = async () => {
    if (!draft.name.trim()) return;
    const res = await imageApi.search(draft.name);
    const data = unwrap<{ urls?: string[] }>(res);
    if (data.urls?.[0]) setDraft((d) => ({ ...d, image: data.urls![0] }));
  };

  if (deckQuery.isLoading || termsQuery.isLoading) return <LoadingView />;
  if (deckQuery.isError) return <ErrorView message="Could not load deck" onRetry={() => deckQuery.refetch()} />;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.form}>
        <TextInput label="Term" mode="outlined" value={draft.name} onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))} />
        <TextInput
          label="Meaning"
          mode="outlined"
          value={draft.meaning}
          onChangeText={(v) => setDraft((d) => ({ ...d, meaning: v }))}
          style={{ marginTop: 8 }}
        />
        <View style={styles.row}>
          <Button mode="outlined" onPress={translate} compact>
            Translate
          </Button>
          <Button mode="outlined" onPress={searchImage} compact>
            Find image
          </Button>
          <Button
            mode="contained"
            onPress={() => addMutation.mutate()}
            loading={addMutation.isPending}
            disabled={!draft.name.trim() || addMutation.isPending}
            compact
          >
            Add
          </Button>
        </View>
      </View>

      <FlatList
        data={terms}
        keyExtractor={(item) => item.id!}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.termRow, { borderColor: theme.colors.outlineVariant }]}>
            <View style={{ flex: 1 }}>
              <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                {item.name}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {item.meaning}
              </Text>
            </View>
            <IconButton icon="delete" onPress={() => item.id && deleteMutation.mutate(item.id)} />
          </View>
        )}
        ListHeaderComponent={
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
            Terms ({terms.length})
          </Text>
        }
      />

      <Button mode="text" onPress={() => router.back()} style={{ margin: 16 }}>
        Done
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { padding: 16, paddingBottom: 8 },
  row: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  list: { padding: 16, paddingTop: 0, gap: 8 },
  termRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 12,
  },
});

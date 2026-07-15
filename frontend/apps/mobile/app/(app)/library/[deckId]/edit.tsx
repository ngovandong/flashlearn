import React, { useState } from "react";
import { FlatList, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Divider,
  IconButton,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeckDetail, Term } from "@flashlearn/core";
import { resolveImageUrl } from "@flashlearn/core";
import { deckApi, imageApi, termApi, translateApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";

interface DraftTerm extends Term {
  name: string;
  meaning: string;
  image: string;
}

const EMPTY_DRAFT: DraftTerm = { name: "", meaning: "", image: "" };

export default function EditDeckScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();

  const [addMode, setAddMode] = useState<"single" | "bulk">("single");
  const [draft, setDraft] = useState<DraftTerm>(EMPTY_DRAFT);
  const [imageResults, setImageResults] = useState<string[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [terms, setTerms] = useState<Term[]>([]);

  // Deck settings.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

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

  React.useEffect(() => {
    if (deckQuery.data) {
      setName(deckQuery.data.name ?? "");
      setDescription(deckQuery.data.description ?? "");
      setIsPublic(!!deckQuery.data.is_public);
    }
  }, [deckQuery.data]);

  const refreshDeck = () => {
    termsQuery.refetch();
    qc.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId!) });
  };

  const saveSettingsMutation = useMutation({
    mutationFn: async () =>
      unwrap(await deckApi.partialUpdate(deckId!, { name, description, is_public: isPublic })),
    onSuccess: () => {
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
      qc.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId!) });
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await termApi.addTermsToDeck(deckId!, [{ ...draft }]);
    },
    onSuccess: () => {
      setDraft(EMPTY_DRAFT);
      setImageResults([]);
      refreshDeck();
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (parsed: Term[]) => {
      await termApi.addTermsToDeck(deckId!, parsed);
    },
    onSuccess: () => {
      setBulkText("");
      refreshDeck();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => termApi.delete(id),
    onSuccess: refreshDeck,
  });

  const translate = async () => {
    if (!draft.name.trim()) return;
    const data = unwrap<{ translation?: string }>(await translateApi.translate(draft.name));
    if (data.translation) setDraft((d) => ({ ...d, meaning: data.translation! }));
  };

  const searchImage = async () => {
    if (!draft.name.trim()) return;
    setImageLoading(true);
    try {
      const data = unwrap<{ urls?: string[] }>(await imageApi.search(draft.name));
      const urls = data.urls ?? [];
      setImageResults(urls);
      if (urls[0]) setDraft((d) => ({ ...d, image: urls[0] }));
    } finally {
      setImageLoading(false);
    }
  };

  const aiFill = async () => {
    if (!draft.name.trim()) return;
    setAiLoading(true);
    try {
      const data = unwrap<{
        word_type?: string;
        pronunciation?: string;
        definition?: string;
        synonyms?: string[];
        antonyms?: string[];
        examples?: string[];
        word_forms?: string[];
        word_family?: string[];
      }>(await termApi.aiEnrich(draft.name, draft.meaning));
      setDraft((d) => ({
        ...d,
        ...data,
        meaning: d.meaning || data.definition || "",
        ai_filled: true,
      }));
    } finally {
      setAiLoading(false);
    }
  };

  const parseBulk = (): Term[] =>
    bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const sep = ["\t", " - ", " — ", " – ", ",", "="].find((s) => line.includes(s));
        if (!sep) return { name: line, meaning: "" };
        const idx = line.indexOf(sep);
        return {
          name: line.slice(0, idx).trim(),
          meaning: line.slice(idx + sep.length).trim(),
        };
      })
      .filter((t) => t.name);

  if (deckQuery.isLoading || termsQuery.isLoading) return <LoadingView />;
  if (deckQuery.isError) return <ErrorView message="Could not load deck" onRetry={() => deckQuery.refetch()} />;

  const draftImageUrl = resolveImageUrl(draft.image);
  const parsedCount = parseBulk().length;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        {/* Deck settings */}
        <Pressable onPress={() => setSettingsOpen((o) => !o)} style={styles.settingsHeader}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
            Deck settings
          </Text>
          <IconButton icon={settingsOpen ? "chevron-up" : "chevron-down"} size={20} />
        </Pressable>
        {settingsOpen ? (
          <View style={styles.settingsBody}>
            <TextInput label="Deck name" mode="outlined" value={name} onChangeText={setName} />
            <TextInput
              label="Description"
              mode="outlined"
              value={description}
              onChangeText={setDescription}
              multiline
              style={{ marginTop: 8 }}
            />
            <View style={styles.switchRow}>
              <Text style={{ color: theme.colors.onSurface }}>Public deck</Text>
              <Switch value={isPublic} onValueChange={setIsPublic} />
            </View>
            <Button
              mode="contained-tonal"
              onPress={() => saveSettingsMutation.mutate()}
              loading={saveSettingsMutation.isPending}
              disabled={!name.trim() || saveSettingsMutation.isPending}
            >
              {settingsSaved ? "Saved!" : "Save settings"}
            </Button>
          </View>
        ) : null}

        <Divider style={styles.divider} />

        {/* Add terms */}
        <SegmentedButtons
          value={addMode}
          onValueChange={(v) => setAddMode(v as "single" | "bulk")}
          buttons={[
            { value: "single", label: "Add one", icon: "plus" },
            { value: "bulk", label: "Bulk add", icon: "format-list-bulleted" },
          ]}
        />

        {addMode === "single" ? (
          <View style={styles.form}>
            <TextInput label="Term" mode="outlined" value={draft.name} onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))} />
            <TextInput
              label="Meaning"
              mode="outlined"
              value={draft.meaning}
              onChangeText={(v) => setDraft((d) => ({ ...d, meaning: v }))}
              style={{ marginTop: 8 }}
            />

            {draftImageUrl ? (
              <Image source={{ uri: draftImageUrl }} style={styles.preview} resizeMode="cover" />
            ) : null}

            {imageResults.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
                {imageResults.map((url) => {
                  const resolved = resolveImageUrl(url);
                  if (!resolved) return null;
                  const selected = url === draft.image;
                  return (
                    <Pressable key={url} onPress={() => setDraft((d) => ({ ...d, image: url }))}>
                      <Image
                        source={{ uri: resolved }}
                        style={[
                          styles.thumb,
                          { borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant },
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            <View style={styles.row}>
              <Button mode="outlined" onPress={translate} compact icon="translate">
                Translate
              </Button>
              <Button mode="outlined" onPress={aiFill} loading={aiLoading} disabled={aiLoading || !draft.name.trim()} compact icon="auto-fix">
                {draft.ai_filled ? "AI filled" : "AI fill"}
              </Button>
              <Button mode="outlined" onPress={searchImage} loading={imageLoading} disabled={imageLoading || !draft.name.trim()} compact icon="image-search">
                Find image
              </Button>
            </View>
            <Button
              mode="contained"
              onPress={() => addMutation.mutate()}
              loading={addMutation.isPending}
              disabled={!draft.name.trim() || addMutation.isPending}
              style={{ marginTop: 8 }}
            >
              Add term
            </Button>
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput
              label="Paste terms"
              mode="outlined"
              value={bulkText}
              onChangeText={setBulkText}
              multiline
              numberOfLines={6}
              placeholder={"apple - quả táo\nrun - chạy\nhouse, ngôi nhà"}
              style={styles.bulkInput}
            />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
              One per line. Separate term and meaning with a dash, comma or tab.
            </Text>
            <Button
              mode="contained"
              onPress={() => bulkMutation.mutate(parseBulk())}
              loading={bulkMutation.isPending}
              disabled={parsedCount === 0 || bulkMutation.isPending}
              style={{ marginTop: 8 }}
            >
              {parsedCount > 0 ? `Add ${parsedCount} term${parsedCount > 1 ? "s" : ""}` : "Add terms"}
            </Button>
          </View>
        )}

        <Divider style={styles.divider} />

        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
          Terms ({terms.length})
        </Text>
        {terms.map((item) => (
          <View key={item.id} style={[styles.termRow, { borderColor: theme.colors.outlineVariant }]}>
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
        ))}
      </ScrollView>

      <Button mode="text" onPress={() => router.back()} style={styles.done}>
        Done
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 8 },
  settingsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  settingsBody: { gap: 8, marginTop: 4 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 4 },
  divider: { marginVertical: 16 },
  form: { marginTop: 12 },
  row: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  preview: { width: "100%", height: 160, borderRadius: 10, marginTop: 12 },
  thumbRow: { gap: 8, marginTop: 12 },
  thumb: { width: 72, height: 72, borderRadius: 8, borderWidth: 2 },
  bulkInput: { minHeight: 120 },
  termRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 12,
    marginBottom: 8,
  },
  done: { margin: 16 },
});

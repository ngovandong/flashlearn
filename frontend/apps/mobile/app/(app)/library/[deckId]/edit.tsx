import React, { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Snackbar, Switch, Text, TextInput } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeckDetail, Term } from "@flashlearn/core";
import { resolveImageUrl } from "@flashlearn/core";
import { deckApi, imageApi, termApi, translateApi } from "@/api/services";
import { uploadImageToCloudinary } from "@/utils/cloudinaryUpload";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { AppCard } from "@/components/ui/AppCard";
import { GradientButton } from "@/components/ui/GradientButton";
import { PillTabs } from "@/components/ui/PillTabs";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens, type Tokens } from "@/theme/tokens";

interface DraftTerm extends Term {
  name: string;
  meaning: string;
  image: string;
}

const EMPTY_DRAFT: DraftTerm = { name: "", meaning: "", image: "" };

/** Small outlined action chip (Translate / AI fill / Find image). */
function ActionChip({
  label,
  icon,
  onPress,
  loading,
  disabled,
  t,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  t: Tokens;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.actionChip,
        { borderColor: t.neutral.border, borderRadius: t.radii.pill, opacity: disabled || loading ? 0.5 : 1 },
      ]}
    >
      <MaterialIcons name={(loading ? "hourglass-empty" : icon) as any} size={16} color={t.palette.primary} />
      <Text style={{ color: t.palette.primary, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </PressableScale>
  );
}

export default function EditDeckScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [addMode, setAddMode] = useState<"single" | "bulk">("single");
  const [draft, setDraft] = useState<DraftTerm>(EMPTY_DRAFT);
  const [imageResults, setImageResults] = useState<string[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
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
    // Term count shown on the library cards / deck-detail hub needs a refresh too.
    qc.invalidateQueries({ queryKey: ["decks"] });
  };

  const saveSettingsMutation = useMutation({
    mutationFn: async () =>
      unwrap(await deckApi.partialUpdate(deckId!, { name, description, is_public: isPublic })),
    onSuccess: () => {
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
      qc.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId!) });
      qc.invalidateQueries({ queryKey: ["decks"] });
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
    onError: () => setSnack("Couldn't delete the term. Please try again."),
  });

  const confirmDeleteTerm = (id: string, name?: string) => {
    if (terms.length <= 4) {
      setSnack("A deck needs at least 4 terms — add more before removing this one.");
      return;
    }
    Alert.alert(
      "Delete term?",
      name ? `"${name}" will be permanently removed from this deck.` : "This term will be permanently removed from this deck.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(id) },
      ]
    );
  };

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

  const pickAndUploadImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setSnack("Photo library access is required to upload an image.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setImageUploading(true);
    try {
      const url = await uploadImageToCloudinary(asset.uri);
      setDraft((d) => ({ ...d, image: url }));
    } catch (error) {
      setSnack("Image upload failed. Please try again.");
    } finally {
      setImageUploading(false);
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
      .filter((tm) => tm.name);

  if (deckQuery.isLoading || termsQuery.isLoading) return <LoadingView />;
  if (deckQuery.isError) return <ErrorView message="Could not load deck" onRetry={() => deckQuery.refetch()} />;

  const draftImageUrl = resolveImageUrl(draft.image);
  const parsedCount = parseBulk().length;

  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <FadeSlideIn>
          <AppCard>
            <Pressable onPress={() => setSettingsOpen((o) => !o)} style={styles.settingsHeader}>
              <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800" }}>
                Deck settings
              </Text>
              <MaterialIcons
                name={settingsOpen ? "expand-less" : "expand-more"}
                size={24}
                color={t.neutral.textMuted}
              />
            </Pressable>
            {settingsOpen ? (
              <View style={styles.settingsBody}>
                <TextInput label="Deck name" mode="outlined" value={name} onChangeText={setName} outlineStyle={{ borderRadius: t.radii.md }} style={styles.input} />
                <TextInput
                  label="Description"
                  mode="outlined"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  outlineStyle={{ borderRadius: t.radii.md }}
                  style={[styles.input, { marginTop: 8 }]}
                />
                <View style={[styles.switchRow, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.md }]}>
                  <Text style={{ color: t.neutral.text, fontWeight: "700" }}>Public deck</Text>
                  <Switch value={isPublic} onValueChange={setIsPublic} color={t.palette.primary} />
                </View>
                <GradientButton
                  label={settingsSaved ? "Saved!" : "Save settings"}
                  onPress={() => saveSettingsMutation.mutate()}
                  loading={saveSettingsMutation.isPending}
                  disabled={!name.trim() || saveSettingsMutation.isPending}
                  style={{ marginTop: 12 }}
                />
              </View>
            ) : null}
          </AppCard>
        </FadeSlideIn>

        <FadeSlideIn delay={60} style={{ marginTop: 16 }}>
          <AppCard>
            <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800", marginBottom: 12 }}>
              Add terms
            </Text>
            <PillTabs
              value={addMode}
              onChange={(v) => setAddMode(v)}
              options={[
                { value: "single", label: "Add one" },
                { value: "bulk", label: "Bulk add" },
              ]}
            />

            {addMode === "single" ? (
              <View style={styles.form}>
                <TextInput label="Term" mode="outlined" value={draft.name} onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))} outlineStyle={{ borderRadius: t.radii.md }} style={styles.input} />
                <TextInput
                  label="Meaning"
                  mode="outlined"
                  value={draft.meaning}
                  onChangeText={(v) => setDraft((d) => ({ ...d, meaning: v }))}
                  outlineStyle={{ borderRadius: t.radii.md }}
                  style={[styles.input, { marginTop: 8 }]}
                />

                {draftImageUrl ? (
                  <Image source={{ uri: draftImageUrl }} style={[styles.preview, { borderRadius: t.radii.md }]} resizeMode="cover" />
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
                            style={[styles.thumb, { borderColor: selected ? t.palette.primary : t.neutral.border }]}
                          />
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : null}

                <View style={styles.actionRow}>
                  <ActionChip label="Translate" icon="translate" onPress={translate} t={t} disabled={!draft.name.trim()} />
                  <ActionChip label={draft.ai_filled ? "AI filled" : "AI fill"} icon="auto-fix-high" onPress={aiFill} loading={aiLoading} disabled={!draft.name.trim()} t={t} />
                  <ActionChip label="Find image" icon="image-search" onPress={searchImage} loading={imageLoading} disabled={!draft.name.trim()} t={t} />
                  <ActionChip label="Upload photo" icon="upload" onPress={pickAndUploadImage} loading={imageUploading} disabled={imageUploading} t={t} />
                </View>
                <GradientButton
                  label="Add term"
                  icon="add"
                  onPress={() => addMutation.mutate()}
                  loading={addMutation.isPending}
                  disabled={!draft.name.trim() || addMutation.isPending}
                  style={{ marginTop: 12 }}
                />
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
                  outlineStyle={{ borderRadius: t.radii.md }}
                  style={[styles.input, styles.bulkInput]}
                />
                <Text variant="bodySmall" style={{ color: t.neutral.textMinor, marginTop: 6 }}>
                  One per line. Separate term and meaning with a dash, comma or tab.
                </Text>
                <GradientButton
                  label={parsedCount > 0 ? `Add ${parsedCount} term${parsedCount > 1 ? "s" : ""}` : "Add terms"}
                  onPress={() => bulkMutation.mutate(parseBulk())}
                  loading={bulkMutation.isPending}
                  disabled={parsedCount === 0 || bulkMutation.isPending}
                  style={{ marginTop: 12 }}
                />
              </View>
            )}
          </AppCard>
        </FadeSlideIn>

        <FadeSlideIn delay={120} style={{ marginTop: 16 }}>
          <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800", marginBottom: 10 }}>
            Terms ({terms.length})
          </Text>
          <View style={{ gap: 10 }}>
            {terms.map((item) => (
              <AppCard key={item.id} padding={14}>
                <View style={styles.termRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleSmall" style={{ color: t.neutral.text, fontWeight: "700" }}>
                      {item.name}
                    </Text>
                    <Text variant="bodySmall" style={{ color: t.neutral.textMinor }}>
                      {item.meaning}
                    </Text>
                  </View>
                  <PressableScale onPress={() => item.id && confirmDeleteTerm(item.id, item.name)} hitSlop={8} style={styles.deleteBtn}>
                    <MaterialIcons name="delete-outline" size={22} color={t.neutral.textMuted} />
                  </PressableScale>
                </View>
              </AppCard>
            ))}
          </View>
        </FadeSlideIn>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: t.neutral.surface, borderTopColor: t.neutral.border, paddingBottom: insets.bottom + 72 }]}>
        <GradientButton label="Done" icon="check" onPress={() => router.back()} />
      </View>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3000}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 24 },
  settingsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  settingsBody: { gap: 8, marginTop: 12 },
  input: { backgroundColor: "transparent" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, marginTop: 4 },
  form: { marginTop: 14 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  actionChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1.5 },
  preview: { width: "100%", height: 160, marginTop: 12 },
  thumbRow: { gap: 8, marginTop: 12 },
  thumb: { width: 72, height: 72, borderRadius: 10, borderWidth: 2 },
  bulkInput: { minHeight: 120 },
  termRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  deleteBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
});

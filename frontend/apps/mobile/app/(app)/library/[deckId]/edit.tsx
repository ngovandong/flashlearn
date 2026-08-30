import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Snackbar, Switch, Text, TextInput } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeckDetail, Term } from "@flashlearn/core";
import { resolveImageUrl, TERM_EDIT_PAGE_SIZE } from "@flashlearn/core";
import { deckApi, imageApi, termApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { AppCard } from "@/components/ui/AppCard";
import { GradientButton } from "@/components/ui/GradientButton";
import { PillTabs } from "@/components/ui/PillTabs";
import TermEditorSheet from "@/components/TermEditorSheet";
import BulkTermsSheet from "@/components/BulkTermsSheet";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens, type Tokens } from "@/theme/tokens";

const SEARCH_DEBOUNCE_MS = 400;

type SortKey = "newest" | "oldest" | "az";

interface TermPage {
  count: number;
  results: Term[];
}

/** One row in the term list — tap to edit, tap the circle to select. */
function TermListRow({
  term,
  selected,
  onToggle,
  onEdit,
  onDelete,
  t,
}: {
  term: Term;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: Tokens;
}) {
  const imageUrl = resolveImageUrl(term.image);
  return (
    <AppCard padding={10} style={selected ? { borderColor: t.palette.primary, borderWidth: 1.5 } : undefined}>
      <View style={styles.termRow}>
        <PressableScale onPress={onToggle} hitSlop={8} style={styles.rowIconBtn}>
          <MaterialIcons
            name={selected ? "check-circle" : "radio-button-unchecked"}
            size={22}
            color={selected ? t.palette.primary : t.neutral.textMuted}
          />
        </PressableScale>
        <Pressable onPress={onEdit} style={styles.termText}>
          <Text variant="titleSmall" style={{ color: t.neutral.text, fontWeight: "700" }} numberOfLines={1}>
            {term.name}
          </Text>
          <Text variant="bodySmall" style={{ color: t.neutral.textMinor }} numberOfLines={2}>
            {term.meaning || "No meaning yet"}
          </Text>
        </Pressable>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={[styles.rowThumb, { borderRadius: t.radii.sm }]} />
        ) : null}
        {term.ai_filled ? (
          <MaterialIcons name="auto-fix-high" size={16} color={t.palette.primary} />
        ) : null}
        <PressableScale onPress={onDelete} hitSlop={8} style={styles.rowIconBtn}>
          <MaterialIcons name="delete-outline" size={20} color={t.neutral.textMuted} />
        </PressableScale>
      </View>
    </AppCard>
  );
}

/** Compact chip used by the selection bar. */
function BulkChip({ label, icon, onPress, t }: { label: string; icon: string; onPress: () => void; t: Tokens }) {
  return (
    <PressableScale onPress={onPress} style={[styles.bulkChip, { borderColor: t.neutral.border, borderRadius: t.radii.pill }]}>
      <MaterialIcons name={icon as any} size={15} color={t.palette.primary} />
      <Text style={{ color: t.palette.primary, fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </PressableScale>
  );
}

export default function EditDeckScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [snack, setSnack] = useState<string | null>(null);

  // Deck settings.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Term browsing.
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editorTerm, setEditorTerm] = useState<Term | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<"add" | "edit" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const deckQuery = useQuery({
    queryKey: queryKeys.decks.detail(deckId!),
    queryFn: async () => unwrap<DeckDetail>(await deckApi.retrieve(deckId!)),
    enabled: !!deckId,
  });

  const termsQuery = useQuery({
    queryKey: queryKeys.terms.browse(deckId!, query, sort, page),
    queryFn: async () =>
      unwrap<TermPage>(await termApi.browseTerms(deckId!, { q: query, sort, page })),
    enabled: !!deckId,
    placeholderData: (previous) => previous,
  });

  const totalQuery = useQuery({
    queryKey: queryKeys.terms.total(deckId!),
    queryFn: async () =>
      unwrap<TermPage>(await termApi.browseTerms(deckId!, { page: 1, pageSize: 1 })),
    enabled: !!deckId,
  });

  useEffect(() => {
    if (deckQuery.data) {
      setName(deckQuery.data.name ?? "");
      setDescription(deckQuery.data.description ?? "");
      setIsPublic(!!deckQuery.data.is_public);
    }
  }, [deckQuery.data]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, query, sort]);

  const terms = termsQuery.data?.results ?? [];
  const matchCount = termsQuery.data?.count ?? 0;
  const totalTerms = totalQuery.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(matchCount / TERM_EDIT_PAGE_SIZE));
  const selectedTerms = useMemo(
    () => terms.filter((term) => term.id && selectedIds.includes(term.id)),
    [terms, selectedIds]
  );

  const refreshTerms = () => {
    qc.invalidateQueries({ queryKey: ["terms"] });
    qc.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId!) });
    // Term counts on the library cards need refreshing too.
    qc.invalidateQueries({ queryKey: ["decks"] });
  };

  const handleSaved = (message: string) => {
    setSnack(message);
    setSelectedIds([]);
    refreshTerms();
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
    onError: () => setSnack("Couldn't save the deck settings. Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => termApi.bulkDelete(deckId!, ids),
    onSuccess: (_data, ids) => {
      if (ids.length === terms.length && page > 1) setPage((p) => p - 1);
      handleSaved(`${ids.length} term${ids.length > 1 ? "s" : ""} deleted`);
    },
    onError: () => setSnack("Couldn't delete. Please try again."),
  });

  const confirmDelete = (ids: string[], label: string) => {
    Alert.alert(`Delete ${label}?`, "This can't be undone — saved learning progress goes too.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(ids) },
    ]);
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const selectAllOnPage = () =>
    setSelectedIds((prev) =>
      prev.length === terms.length ? [] : terms.map((term) => term.id!).filter(Boolean)
    );

  /** Enrich the selection one term at a time, then persist in a single call. */
  const runBulkEnrichment = async (
    label: string,
    targets: Term[],
    enrich: (term: Term) => Promise<Partial<Term> | null>
  ) => {
    if (targets.length === 0) {
      setSnack("Nothing to do — the selected terms already have this.");
      return;
    }
    const updated: Term[] = [];
    try {
      for (const [index, term] of targets.entries()) {
        setBusy(`${label} ${index + 1}/${targets.length}`);
        const fields = await enrich(term);
        if (fields) updated.push({ ...term, ...fields });
      }
      if (updated.length > 0) unwrap(await termApi.updateTerms(updated));
      handleSaved(`${updated.length} of ${targets.length} terms updated`);
    } catch {
      setSnack("Something went wrong partway through. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const bulkAiFill = () =>
    runBulkEnrichment(
      "Filling with AI",
      selectedTerms.filter((term) => !term.ai_filled),
      async (term) => {
        const data = unwrap<Partial<Term>>(await termApi.aiEnrich(term.name ?? "", term.meaning ?? ""));
        return { ...data, ai_filled: true };
      }
    );

  const bulkFindImages = () =>
    runBulkEnrichment(
      "Finding images",
      selectedTerms.filter((term) => !term.image),
      async (term) => {
        const data = unwrap<{ urls?: string[] }>(await imageApi.search(term.name ?? ""));
        const url = data.urls?.[0];
        return url ? { image: url } : null;
      }
    );

  const bulkClearImages = async () => {
    const targets = selectedTerms.filter((term) => term.image);
    if (targets.length === 0) {
      setSnack("None of the selected terms has an image.");
      return;
    }
    setBusy("Removing images");
    try {
      unwrap(await termApi.updateTerms(targets.map((term) => ({ ...term, image: "" }))));
      handleSaved(`Image removed from ${targets.length} terms`);
    } catch {
      setSnack("Couldn't update these terms. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const openEditor = (term: Term | null) => {
    setEditorTerm(term);
    setEditorOpen(true);
  };

  if (deckQuery.isLoading) return <LoadingView />;
  if (deckQuery.isError) return <ErrorView message="Could not load deck" onRetry={() => deckQuery.refetch()} />;

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
          <View style={styles.addRow}>
            <GradientButton label="Add term" icon="add" onPress={() => openEditor(null)} style={{ flex: 1 }} />
            <PressableScale
              onPress={() => setBulkMode("add")}
              style={[styles.pasteBtn, { borderColor: t.neutral.border, borderRadius: t.radii.pill }]}
            >
              <MaterialIcons name="playlist-add" size={20} color={t.palette.primary} />
              <Text style={{ color: t.palette.primary, fontWeight: "700" }}>Paste list</Text>
            </PressableScale>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={120} style={{ marginTop: 16 }}>
          <TextInput
            mode="outlined"
            value={search}
            onChangeText={setSearch}
            placeholder="Search this deck's terms…"
            left={<TextInput.Icon icon="magnify" />}
            right={search ? <TextInput.Icon icon="close" onPress={() => setSearch("")} /> : undefined}
            outlineStyle={{ borderRadius: t.radii.md }}
            style={styles.input}
          />
          <View style={{ marginTop: 10 }}>
            <PillTabs
              value={sort}
              onChange={(value) => setSort(value)}
              options={[
                { value: "newest", label: "Newest" },
                { value: "oldest", label: "Oldest" },
                { value: "az", label: "A → Z" },
              ]}
            />
          </View>

          <View style={styles.metaRow}>
            <PressableScale onPress={selectAllOnPage} hitSlop={8} style={styles.rowIconBtn}>
              <MaterialIcons
                name={terms.length > 0 && selectedIds.length === terms.length ? "check-box" : "check-box-outline-blank"}
                size={20}
                color={t.neutral.textMuted}
              />
            </PressableScale>
            <Text variant="bodySmall" style={{ color: t.neutral.textMinor, fontWeight: "700" }}>
              {query
                ? `${matchCount} match${matchCount === 1 ? "" : "es"} of ${totalTerms}`
                : `${totalTerms} term${totalTerms === 1 ? "" : "s"}`}
            </Text>
            {pageCount > 1 ? (
              <Text variant="bodySmall" style={{ color: t.neutral.textMuted, marginLeft: "auto" }}>
                Page {page} of {pageCount}
              </Text>
            ) : null}
          </View>

          {selectedIds.length > 0 ? (
            <AppCard padding={10} style={{ marginBottom: 10 }}>
              <Text style={{ color: t.neutral.text, fontWeight: "800", marginBottom: 8 }}>
                {selectedIds.length} selected
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bulkRow}>
                <BulkChip label="AI fill" icon="auto-fix-high" onPress={bulkAiFill} t={t} />
                <BulkChip label="Find images" icon="image-search" onPress={bulkFindImages} t={t} />
                <BulkChip label="Clear images" icon="hide-image" onPress={bulkClearImages} t={t} />
                <BulkChip label="Edit as text" icon="edit-note" onPress={() => setBulkMode("edit")} t={t} />
                <BulkChip
                  label="Delete"
                  icon="delete-outline"
                  onPress={() =>
                    confirmDelete(
                      selectedIds,
                      `${selectedIds.length} selected term${selectedIds.length > 1 ? "s" : ""}`
                    )
                  }
                  t={t}
                />
              </ScrollView>
            </AppCard>
          ) : null}

          <View style={{ gap: 10, opacity: termsQuery.isFetching ? 0.5 : 1 }}>
            {terms.map((term) => (
              <TermListRow
                key={term.id}
                term={term}
                selected={!!term.id && selectedIds.includes(term.id)}
                onToggle={() => term.id && toggleSelect(term.id)}
                onEdit={() => openEditor(term)}
                onDelete={() => term.id && confirmDelete([term.id], `"${term.name}"`)}
                t={t}
              />
            ))}
            {!termsQuery.isFetching && terms.length === 0 ? (
              <Text style={{ color: t.neutral.textMinor, textAlign: "center", paddingVertical: 24 }}>
                {query ? `No term matches “${query}”.` : "This deck has no terms yet."}
              </Text>
            ) : null}
          </View>

          {pageCount > 1 ? (
            <View style={styles.pager}>
              <PressableScale
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={[styles.pagerBtn, { borderColor: t.neutral.border, borderRadius: t.radii.pill, opacity: page === 1 ? 0.4 : 1 }]}
              >
                <MaterialIcons name="chevron-left" size={20} color={t.palette.primary} />
                <Text style={{ color: t.palette.primary, fontWeight: "700" }}>Prev</Text>
              </PressableScale>
              <PressableScale
                onPress={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
                style={[styles.pagerBtn, { borderColor: t.neutral.border, borderRadius: t.radii.pill, opacity: page === pageCount ? 0.4 : 1 }]}
              >
                <Text style={{ color: t.palette.primary, fontWeight: "700" }}>Next</Text>
                <MaterialIcons name="chevron-right" size={20} color={t.palette.primary} />
              </PressableScale>
            </View>
          ) : null}
        </FadeSlideIn>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: t.neutral.surface, borderTopColor: t.neutral.border, paddingBottom: insets.bottom + 72 }]}>
        <GradientButton label="Done" icon="check" onPress={() => router.back()} />
      </View>

      <TermEditorSheet
        visible={editorOpen}
        deckId={deckId!}
        term={editorTerm}
        onClose={() => setEditorOpen(false)}
        onSaved={handleSaved}
        onError={setSnack}
      />
      <BulkTermsSheet
        visible={bulkMode != null}
        mode={bulkMode ?? "add"}
        deckId={deckId!}
        terms={selectedTerms}
        onClose={() => setBulkMode(null)}
        onSaved={handleSaved}
        onError={setSnack}
      />

      {busy ? (
        <View style={styles.busyOverlay}>
          <View style={[styles.busyCard, { backgroundColor: t.neutral.surface, borderRadius: t.radii.lg }]}>
            <ActivityIndicator color={t.palette.primary} />
            <Text style={{ color: t.neutral.text, fontWeight: "700" }}>{busy}</Text>
          </View>
        </View>
      ) : null}

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
  addRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  pasteBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, height: 52, borderWidth: 1.5 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, marginBottom: 10 },
  termRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  termText: { flex: 1, minWidth: 0 },
  rowThumb: { width: 36, height: 36 },
  rowIconBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  bulkRow: { gap: 8 },
  bulkChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1.5 },
  pager: { flexDirection: "row", justifyContent: "center", gap: 12, paddingVertical: 20 },
  pagerBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1.5 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  busyOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  busyCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
});

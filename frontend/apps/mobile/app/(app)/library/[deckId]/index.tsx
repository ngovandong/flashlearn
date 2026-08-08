import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { Menu, Snackbar, Text } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeckDetail } from "@flashlearn/core";
import { deckApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { AppCard } from "@/components/ui/AppCard";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useFloatingTabBarHeight } from "@/components/ui/FloatingTabBar";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens, type Tokens } from "@/theme/tokens";

interface ActionDef {
  key: string;
  label: string;
  hint: string;
  icon: string;
  route: string;
  locked: boolean;
}

function ActionCard({
  action,
  onPress,
  t,
}: {
  action: ActionDef;
  onPress: () => void;
  t: Tokens;
}) {
  const { fg } = t.feature(action.icon);
  const locked = action.locked;
  return (
    <AppCard onPress={locked ? undefined : onPress} padding={14} style={locked ? styles.locked : undefined}>
      <View style={styles.actionRow}>
        <FeatureTile icon={action.icon} size={44} />
        <View style={styles.actionBody}>
          <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "700" }}>
            {action.label}
          </Text>
          <Text variant="bodySmall" style={{ color: t.neutral.textMinor, marginTop: 1 }}>
            {action.hint}
          </Text>
        </View>
        <MaterialIcons
          name={locked ? "lock-outline" : "chevron-right"}
          size={locked ? 18 : 22}
          color={locked ? t.neutral.textMuted : fg}
        />
      </View>
    </AppCard>
  );
}

function StatRow({ label, value, color, t }: { label: string; value: number; color: string; t: Tokens }) {
  return (
    <View style={styles.statRow}>
      <View style={styles.statLabel}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text variant="bodyMedium" style={{ color: t.neutral.textMinor }}>
          {label}
        </Text>
      </View>
      <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800" }}>
        {value}
      </Text>
    </View>
  );
}

export default function DeckDetailScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const t = useTokens();
  const tabBarHeight = useFloatingTabBarHeight();
  const router = useRouter();
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const { data: deck, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.decks.detail(deckId!),
    queryFn: async () => unwrap<DeckDetail>(await deckApi.retrieve(deckId!)),
    enabled: !!deckId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId!) });
    qc.invalidateQueries({ queryKey: ["decks"] });
  };

  const joinMutation = useMutation({
    mutationFn: async () => unwrap(await deckApi.joinDeck(deckId!)),
    onSuccess: () => {
      setSnack("Joined deck");
      invalidateAll();
    },
    onError: (e: Error) => setSnack(e.message),
  });

  const cloneMutation = useMutation({
    mutationFn: async () => unwrap<DeckDetail>(await deckApi.cloneDeck(deckId!)),
    onSuccess: (cloned) => {
      invalidateAll();
      router.replace(`/library/${cloned.id}`);
    },
    onError: (e: Error) => setSnack(e.message),
  });

  const resetMutation = useMutation({
    mutationFn: async () => unwrap(await deckApi.clearLearningProgress(deckId!)),
    onSuccess: () => {
      setSnack("Learning progress reset");
      invalidateAll();
    },
    onError: (e: Error) => setSnack(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => unwrap(await deckApi.delete(deckId!)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["decks"] });
      router.replace("/library");
    },
    onError: (e: Error) => setSnack(e.message),
  });

  const leaveMutation = useMutation({
    mutationFn: async () => unwrap(await deckApi.leaveDeck(deckId!)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["decks"] });
      router.replace("/library");
    },
    onError: (e: Error) => setSnack(e.message),
  });

  if (isLoading) return <ScreenSkeleton rows={4} />;
  if (isError || !deck) return <ErrorView message="Could not load deck" onRetry={() => refetch()} />;

  const progress = deck.learning_progress ?? {};
  const total = deck.number_of_term ?? 0;
  const completed = progress.completed ?? 0;
  const learning = progress.learning ?? 0;
  const left = progress.left ?? Math.max(total - completed - learning, 0);
  const learnedToday = progress.learned_today ?? 0;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const canEdit = deck.my_permission === "O" || deck.my_permission === "E";
  const isOwner = deck.my_permission === "O";

  const actions: ActionDef[] = [
    { key: "learn", label: "Learn", hint: "Flashcards & spaced study", icon: "school", route: `/library/${deckId}/learn`, locked: total === 0 },
    { key: "revise", label: "Revise", hint: "Quiz yourself on the terms", icon: "auto-stories", route: `/library/${deckId}/revise`, locked: total < 4 },
    { key: "quick", label: "Quick revise game", hint: "Fast-paced solo drill", icon: "bolt", route: `/library/${deckId}/revise/quick-revise`, locked: total < 4 },
    { key: "competition", label: "Competition", hint: "Beat bots & climb the board", icon: "emoji-events", route: `/library/${deckId}/competition`, locked: total < 4 },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: t.neutral.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight }]}
      showsVerticalScrollIndicator={false}
    >
      <FadeSlideIn>
        <Text variant="headlineMedium" style={{ color: t.neutral.text, fontWeight: "800" }}>
          {deck.name}
        </Text>
        {deck.description ? (
          <Text variant="bodyMedium" style={{ color: t.neutral.textMinor, marginTop: 6 }}>
            {deck.description}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <View style={[styles.metaChip, { backgroundColor: t.primaryAlpha(0.1) }]}>
            <MaterialIcons name="style" size={14} color={t.palette.primary} />
            <Text variant="labelMedium" style={{ color: t.palette.primary, fontWeight: "700" }}>
              {total} {total === 1 ? "term" : "terms"}
            </Text>
          </View>
          <View style={[styles.metaChip, { backgroundColor: t.primaryAlpha(0.1) }]}>
            <MaterialIcons name="trending-up" size={14} color={t.palette.primary} />
            <Text variant="labelMedium" style={{ color: t.palette.primary, fontWeight: "700" }}>
              {pct}% learned
            </Text>
          </View>
        </View>
      </FadeSlideIn>

      <View style={styles.actions}>
        {actions.map((action, i) => (
          <FadeSlideIn key={action.key} delay={60 + i * 50}>
            <ActionCard action={action} onPress={() => router.push(action.route as any)} t={t} />
          </FadeSlideIn>
        ))}
      </View>

      {total > 0 ? (
        <>
          <FadeSlideIn delay={280}>
            <AppCard padding={16} style={[styles.quote, { backgroundColor: t.primaryAlpha(0.1), borderColor: "transparent" }]} flat>
              <View style={styles.quoteRow}>
                <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800", flex: 1 }}>
                  {learnedToday > 0
                    ? `Way to go! You've reviewed ${learnedToday} ${learnedToday === 1 ? "word" : "words"} today.`
                    : "Ready to learn? Start a session to build your streak."}
                </Text>
                <Text style={styles.trumpet}>🎉</Text>
              </View>
            </AppCard>
          </FadeSlideIn>

          <FadeSlideIn delay={340}>
            <AppCard padding={18}>
              <SectionHeader title="Learning progress" />
              <View style={styles.progressBody}>
                <ProgressRing value={pct} size={116} />
                <View style={styles.stats}>
                  <StatRow label="Learning" value={learning} color={t.palette.accent ?? t.palette.primary} t={t} />
                  <StatRow label="Mastered" value={completed} color={t.palette.primary} t={t} />
                  <StatRow label="Left" value={left} color={t.neutral.textMuted} t={t} />
                </View>
              </View>
            </AppCard>
          </FadeSlideIn>
        </>
      ) : null}

      {deck.my_permission ? (
        <FadeSlideIn delay={400} style={styles.secondary}>
          {canEdit ? (
            <PressableScale
              style={[styles.secondaryBtn, { borderColor: t.neutral.border, backgroundColor: t.neutral.surface }]}
              onPress={() => router.push(`/library/${deckId}/edit`)}
            >
              <MaterialIcons name="edit" size={18} color={t.palette.primary} />
              <Text variant="labelLarge" style={{ color: t.palette.primary, fontWeight: "700" }}>
                Edit deck
              </Text>
            </PressableScale>
          ) : null}
          {isOwner ? (
            <PressableScale
              style={[styles.secondaryBtn, { borderColor: t.neutral.border, backgroundColor: t.neutral.surface }]}
              onPress={() => router.push(`/library/${deckId}/share`)}
            >
              <MaterialIcons name="group-add" size={18} color={t.palette.primary} />
              <Text variant="labelLarge" style={{ color: t.palette.primary, fontWeight: "700" }}>
                Share
              </Text>
            </PressableScale>
          ) : null}
          <Menu
            visible={menuOpen}
            onDismiss={() => setMenuOpen(false)}
            anchor={
              <PressableScale
                style={[styles.moreBtn, { borderColor: t.neutral.border, backgroundColor: t.neutral.surface }]}
                onPress={() => setMenuOpen(true)}
              >
                <MaterialIcons name="more-horiz" size={20} color={t.neutral.textMinor} />
              </PressableScale>
            }
          >
            <Menu.Item
              leadingIcon="restart"
              title="Reset progress"
              onPress={() => {
                setMenuOpen(false);
                resetMutation.mutate();
              }}
            />
            <Menu.Item
              leadingIcon="delete-outline"
              title={isOwner ? "Delete deck" : "Remove deck"}
              onPress={() => {
                setMenuOpen(false);
                Alert.alert(
                  isOwner ? "Delete this deck?" : "Remove this deck?",
                  isOwner
                    ? "This permanently deletes the deck and all of its terms. This can't be undone."
                    : "This removes the deck from your library. You can join it again later.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: isOwner ? "Delete" : "Remove",
                      style: "destructive",
                      onPress: () => (isOwner ? deleteMutation.mutate() : leaveMutation.mutate()),
                    },
                  ]
                );
              }}
            />
          </Menu>
        </FadeSlideIn>
      ) : (
        <FadeSlideIn delay={400} style={styles.secondary}>
          <PressableScale
            style={[styles.secondaryBtn, { borderColor: t.neutral.border, backgroundColor: t.neutral.surface }]}
            onPress={() => joinMutation.mutate()}
          >
            <MaterialIcons name="add-circle-outline" size={18} color={t.palette.primary} />
            <Text variant="labelLarge" style={{ color: t.palette.primary, fontWeight: "700" }}>
              Join deck
            </Text>
          </PressableScale>
          <PressableScale
            style={[styles.secondaryBtn, { borderColor: t.neutral.border, backgroundColor: t.neutral.surface }]}
            onPress={() => cloneMutation.mutate()}
          >
            <MaterialIcons name="content-copy" size={18} color={t.palette.primary} />
            <Text variant="labelLarge" style={{ color: t.palette.primary, fontWeight: "700" }}>
              Clone deck
            </Text>
          </PressableScale>
        </FadeSlideIn>
      )}

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3000}>
        {snack}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  metaRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  actions: { gap: 10 },
  locked: { opacity: 0.55 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  actionBody: { flex: 1 },
  quote: {},
  quoteRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  trumpet: { fontSize: 28 },
  progressBody: { flexDirection: "row", alignItems: "center", gap: 20, marginTop: 14 },
  stats: { flex: 1, gap: 12 },
  statRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  secondary: { flexDirection: "row", gap: 10, marginTop: 2 },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
  },
  moreBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
  },
});

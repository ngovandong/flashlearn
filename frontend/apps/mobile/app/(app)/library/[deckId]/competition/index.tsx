import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { GAMES } from "@flashlearn/core";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { AppCard } from "@/components/ui/AppCard";
import { competitionApi } from "@/api/services";
import { unwrap } from "@/utils/apiError";
import { useCompetitionPool } from "@/features/competition/useCompetitionPool";
import {
  GAME_ICONS,
  isGameUnlocked,
  requirementReason,
} from "@/features/competition/gameMeta";
import {
  Leaderboard,
  type LeaderboardData,
} from "@/features/competition/Leaderboard";
import { useTokens } from "@/theme/tokens";

export default function CompetitionHub() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const t = useTokens();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useCompetitionPool(deckId!);
  const [board, setBoard] = useState<{
    title: string;
    loading: boolean;
    data: LeaderboardData | null;
  } | null>(null);

  const openBoard = async (key: string, title: string) => {
    setBoard({ title, loading: true, data: null });
    try {
      const res = await unwrap<LeaderboardData>(
        await competitionApi.getLeaderboard(deckId!, key)
      );
      setBoard({ title, loading: false, data: res });
    } catch {
      setBoard({ title, loading: false, data: null });
    }
  };

  if (isLoading) return <LoadingView />;
  if (isError || !data)
    return <ErrorView message="Could not load games" onRetry={() => refetch()} />;

  const available = data.pool.available;

  return (
    <ScrollView
      style={{ backgroundColor: t.neutral.bg }}
      contentContainerStyle={styles.pad}
      showsVerticalScrollIndicator={false}
    >
      <Text variant="bodyMedium" style={{ color: t.neutral.textMinor, marginBottom: 14 }}>
        Play against bots, beat your ghost, and climb the leaderboards.
      </Text>

      {GAMES.map((game, i) => {
        const unlocked = isGameUnlocked(game.requires, available);
        return (
          <FadeSlideIn key={game.key} delay={i * 50} style={styles.item}>
            <AppCard
              padding={14}
              onPress={unlocked ? () => router.push(`/library/${deckId}/competition/${game.key}`) : undefined}
              style={unlocked ? undefined : styles.locked}
            >
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: t.primaryAlpha(0.12) }]}>
                  <MaterialCommunityIcons
                    name={GAME_ICONS[game.key] as any}
                    size={26}
                    color={t.palette.primary}
                  />
                </View>
                <View style={styles.body}>
                  <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "700" }}>
                    {game.title}
                  </Text>
                  <Text variant="bodySmall" style={{ color: t.neutral.textMinor, marginTop: 1 }}>
                    {unlocked ? game.tagline : requirementReason(game.requires)}
                  </Text>
                </View>
                {unlocked ? (
                  <Pressable hitSlop={8} onPress={() => openBoard(game.key, game.title)} style={styles.trophy}>
                    <MaterialCommunityIcons name="trophy-outline" size={22} color={t.neutral.textMuted} />
                  </Pressable>
                ) : (
                  <MaterialCommunityIcons name="lock" size={20} color={t.neutral.textMuted} />
                )}
              </View>
            </AppCard>
          </FadeSlideIn>
        );
      })}

      <Leaderboard
        visible={!!board}
        onDismiss={() => setBoard(null)}
        title={board?.title ?? ""}
        data={board?.data ?? null}
        loading={board?.loading ?? false}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  item: { marginBottom: 12 },
  locked: { opacity: 0.6 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  body: { flex: 1 },
  trophy: { padding: 4 },
});

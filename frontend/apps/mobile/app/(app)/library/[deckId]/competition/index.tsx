import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { GAMES } from "@flashlearn/core";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
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

export default function CompetitionHub() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const theme = useTheme();
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
      contentContainerStyle={[styles.pad, { backgroundColor: theme.colors.background }]}
    >
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
        Play against bots, beat your ghost, and climb the leaderboards.
      </Text>

      {GAMES.map((game) => {
        const unlocked = isGameUnlocked(game.requires, available);
        return (
          <Pressable
            key={game.key}
            disabled={!unlocked}
            onPress={() => router.push(`/library/${deckId}/competition/${game.key}`)}
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outlineVariant,
                opacity: unlocked ? 1 : 0.6,
              },
            ]}
          >
            <View
              style={[
                styles.icon,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <MaterialCommunityIcons
                name={GAME_ICONS[game.key] as any}
                size={26}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.body}>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                {game.title}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {unlocked ? game.tagline : requirementReason(game.requires)}
              </Text>
            </View>
            {unlocked ? (
              <Pressable
                hitSlop={8}
                onPress={() => openBoard(game.key, game.title)}
                style={styles.trophy}
              >
                <MaterialCommunityIcons
                  name="trophy-outline"
                  size={22}
                  color={theme.colors.onSurfaceVariant}
                />
              </Pressable>
            ) : (
              <MaterialCommunityIcons
                name="lock"
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            )}
          </Pressable>
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
  pad: { padding: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  icon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  body: { flex: 1 },
  trophy: { padding: 4 },
});

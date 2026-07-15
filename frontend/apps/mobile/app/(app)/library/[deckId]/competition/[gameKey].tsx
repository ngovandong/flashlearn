import React, { useCallback, useEffect, useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { getGameMeta } from "@flashlearn/core";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { competitionApi } from "@/api/services";
import { unwrap } from "@/utils/apiError";
import { useCompetitionPool } from "@/features/competition/useCompetitionPool";
import { useGameSound } from "@/features/competition/useGameSound";
import { GameShell } from "@/features/competition/GameShell";
import { GameOver } from "@/features/competition/GameOver";
import { Countdown } from "@/features/competition/Countdown";
import { isGameUnlocked } from "@/features/competition/gameMeta";
import {
  Leaderboard,
  type LeaderboardData,
} from "@/features/competition/Leaderboard";
import { GAME_COMPONENTS } from "@/features/competition/games";

export default function CompetitionGameScreen() {
  const { deckId, gameKey } = useLocalSearchParams<{ deckId: string; gameKey: string }>();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useCompetitionPool(deckId!);
  const sound = useGameSound();

  const meta = getGameMeta(gameKey as any);
  const GameComponent = gameKey ? GAME_COMPONENTS[gameKey] : undefined;

  const [runKey, setRunKey] = useState(0);
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);
  const [best, setBest] = useState(0);
  const [result, setResult] = useState<{
    finalScore: number;
    isNewBest: boolean;
    rank: number | null;
  } | null>(null);
  const [board, setBoard] = useState<{ loading: boolean; data: LeaderboardData | null } | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    if (!deckId || !gameKey) return;
    competitionApi
      .getLeaderboard(deckId, gameKey)
      .then((res) => {
        const payload = res?.data as LeaderboardData | undefined;
        if (active && payload?.my_score != null) setBest(payload.my_score);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [deckId, gameKey]);

  const handleGameOver = useCallback(
    async (finalScore: number) => {
      if (submitting.current) return;
      submitting.current = true;
      const rounded = Math.round(finalScore);
      setScore(rounded);
      try {
        const payload = await unwrap<{ best_score: number; improved: boolean; rank: number }>(
          await competitionApi.submitScore(deckId!, gameKey!, rounded)
        );
        if (payload.best_score != null) setBest(payload.best_score);
        setResult({ finalScore: rounded, isNewBest: payload.improved, rank: payload.rank });
      } catch {
        setResult({ finalScore: rounded, isNewBest: rounded > best, rank: null });
      }
      submitting.current = false;
    },
    [deckId, gameKey, best]
  );

  const playAgain = () => {
    setScore(0);
    setResult(null);
    setStarted(false);
    setRunKey((k) => k + 1);
  };

  const openBoard = async () => {
    setBoard({ loading: true, data: null });
    try {
      const payload = await unwrap<LeaderboardData>(
        await competitionApi.getLeaderboard(deckId!, gameKey!)
      );
      setBoard({ loading: false, data: payload });
    } catch {
      setBoard({ loading: false, data: null });
    }
  };

  if (isLoading) return <LoadingView />;
  if (isError || !data) return <ErrorView message="Could not load game" onRetry={() => refetch()} />;
  if (!meta || !GameComponent || !isGameUnlocked(meta.requires, data.pool.available)) {
    return <ErrorView message="This game isn't available for this deck." onRetry={() => router.back()} />;
  }

  return (
    <>
      <Stack.Screen options={{ title: meta.title }} />
      <GameShell score={score} best={best} sound={sound} onLeaderboard={openBoard}>
        {started ? (
          <GameComponent
            key={runKey}
            pool={data.pool}
            best={best}
            sound={sound}
            onScore={setScore}
            onGameOver={handleGameOver}
          />
        ) : (
          <Countdown key={`cd-${runKey}`} onDone={() => setStarted(true)} />
        )}
      </GameShell>

      <GameOver
        visible={!!result}
        score={result?.finalScore ?? 0}
        best={best}
        isNewBest={result?.isNewBest ?? false}
        rank={result?.rank ?? null}
        onPlayAgain={playAgain}
        onLeaderboard={openBoard}
        onExit={() => router.back()}
      />

      <Leaderboard
        visible={!!board}
        onDismiss={() => setBoard(null)}
        title={meta.title}
        data={board?.data ?? null}
        loading={board?.loading ?? false}
      />
    </>
  );
}

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import Confetti from "react-confetti";
import { getGameMeta } from "@flashlearn/core";
import { LocalLoadingWrapper } from "@components/loading";
import { competitionService } from "@api-services/competitionService";
import { useCompetitionPool } from "./useCompetitionPool";
import { useGameSound } from "./useGameSound";
import { REQUIREMENT_INFO } from "./gameIcons";
import GameShell from "./GameShell";
import GameOverCard from "./GameOverCard";
import Leaderboard from "./Leaderboard";
import Countdown from "./Countdown";
import { GAME_COMPONENTS } from "./games";

export default function CompetitionGamePage() {
  const { deckID, gameKey } = useParams();
  const { data, isLoading } = useCompetitionPool(deckID);
  const sound = useGameSound();

  const meta = getGameMeta(gameKey);
  const GameComponent = GAME_COMPONENTS[gameKey];

  const [runKey, setRunKey] = useState(0);
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState("playing"); // playing | over
  const [result, setResult] = useState(null); // { finalScore, isNewBest, rank }
  const [best, setBest] = useState(0);
  const [board, setBoard] = useState(null); // { loading, data }
  const submittingRef = useRef(false);

  // Prime "your best" from the leaderboard.
  useEffect(() => {
    let active = true;
    if (!deckID || !gameKey) return;
    competitionService.getLeaderboard(deckID, gameKey).then((res) => {
      if (active && !res.error && res.data?.my_score != null) {
        setBest(res.data.my_score);
      }
    });
    return () => {
      active = false;
    };
  }, [deckID, gameKey]);

  const handleGameOver = useCallback(
    async (finalScore) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setScore(finalScore);
      sound.playFinish();
      const res = await competitionService.submitScore(
        deckID,
        gameKey,
        Math.round(finalScore)
      );
      const payload = res.error ? null : res.data;
      const isNewBest = payload?.improved ?? finalScore > best;
      if (payload?.best_score != null) setBest(payload.best_score);
      setResult({
        finalScore: Math.round(finalScore),
        isNewBest,
        rank: payload?.rank ?? null,
      });
      setPhase("over");
      submittingRef.current = false;
    },
    [deckID, gameKey, best, sound]
  );

  const playAgain = () => {
    setScore(0);
    setResult(null);
    setPhase("playing");
    setStarted(false);
    setRunKey((k) => k + 1);
  };

  const openLeaderboard = async () => {
    setBoard({ loading: true, data: null });
    const res = await competitionService.getLeaderboard(deckID, gameKey);
    setBoard({ loading: false, data: res.error ? null : res.data });
  };

  if (isLoading) return <LocalLoadingWrapper open />;
  if (!meta || !GameComponent) return <Navigate to=".." replace />;

  // Guard direct navigation to a game the deck can't support.
  if (data) {
    const flag = REQUIREMENT_INFO[meta.requires].flag;
    if (!data.pool.available[flag]) return <Navigate to=".." replace />;
  }

  return (
    <GameShell
      title={meta.title}
      score={score}
      best={best}
      sound={sound}
      onLeaderboard={openLeaderboard}
    >
      {data && started && (
        <GameComponent
          key={runKey}
          pool={data.pool}
          best={best}
          sound={sound}
          onScoreChange={setScore}
          onGameOver={handleGameOver}
        />
      )}

      {data && !started && phase === "playing" && (
        <Countdown key={`cd-${runKey}`} onDone={() => setStarted(true)} />
      )}

      {phase === "over" && result && (
        <>
          {result.isNewBest && (
            <Confetti recycle={false} numberOfPieces={260} />
          )}
          <GameOverCard
            score={result.finalScore}
            best={best}
            isNewBest={result.isNewBest}
            rank={result.rank}
            onPlayAgain={playAgain}
            onLeaderboard={openLeaderboard}
          />
        </>
      )}

      <Leaderboard
        open={Boolean(board)}
        onClose={() => setBoard(null)}
        title={meta.title}
        data={board?.data}
        loading={board?.loading}
      />
    </GameShell>
  );
}

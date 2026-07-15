// Bot opponent + ghost pace simulation for the competition games.

import { BOT_PROFILES, type Difficulty } from "./constants";

export interface BotAnswer {
  correct: boolean;
  delayMs: number;
}

// One simulated bot decision: whether it answers correctly and how long it
// "thinks" before committing.
export function simulateBotAnswer(difficulty: Difficulty): BotAnswer {
  const profile = BOT_PROFILES[difficulty];
  const correct = Math.random() < profile.accuracy;
  const delayMs = Math.round(
    profile.minDelayMs + Math.random() * (profile.maxDelayMs - profile.minDelayMs)
  );
  return { correct, delayMs };
}

// Average fraction of the track a bot covers per question (race game). Derived
// from accuracy so harder bots pull ahead.
export function botTrackStep(difficulty: Difficulty, totalQuestions: number): number {
  if (totalQuestions <= 0) return 0;
  return BOT_PROFILES[difficulty].accuracy / totalQuestions;
}

// Ghost line for the tower game: the ghost climbs linearly to reach the
// player's previous best score by the end of the run.
export function ghostScoreAt(
  elapsedMs: number,
  totalMs: number,
  bestScore: number
): number {
  if (totalMs <= 0 || bestScore <= 0) return 0;
  const fraction = Math.min(1, Math.max(0, elapsedMs / totalMs));
  return bestScore * fraction;
}

// Shared scoring + combo logic for the competition games.

export const BASE_POINTS = 10;
export const MAX_COMBO_MULTIPLIER = 4;

export interface ComboState {
  streak: number;
  score: number;
}

export function initialComboState(): ComboState {
  return { streak: 0, score: 0 };
}

// A correct answer every 3 in a row bumps the multiplier, capped at x4.
export function comboMultiplier(streak: number): number {
  return Math.min(MAX_COMBO_MULTIPLIER, 1 + Math.floor(streak / 3));
}

export function applyAnswer(state: ComboState, correct: boolean): ComboState {
  if (!correct) {
    return { streak: 0, score: state.score };
  }
  const streak = state.streak + 1;
  return {
    streak,
    score: state.score + BASE_POINTS * comboMultiplier(streak),
  };
}

// Optional speed bonus (0..BASE_POINTS) for answering with time to spare.
export function timeBonus(remainingMs: number, limitMs: number): number {
  if (limitMs <= 0) return 0;
  const fraction = Math.min(1, Math.max(0, remainingMs / limitMs));
  return Math.round(BASE_POINTS * fraction);
}

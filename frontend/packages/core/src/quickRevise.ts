import type { QuickReviseQuestion, Term } from "./types";

export const QUICK_REVISE_BASE_TIME = 10;
export const QUICK_REVISE_MIN_BASE_TIME = 2;
export const QUICK_REVISE_TIME_DECREMENT = 2;

export function calculateQuickReviseBaseTime(index: number): number {
  return Math.max(
    QUICK_REVISE_MIN_BASE_TIME,
    QUICK_REVISE_BASE_TIME - index * QUICK_REVISE_TIME_DECREMENT
  );
}

export function calculateQuickReviseTimeLimit(
  index: number,
  leftover = 0
): number {
  return calculateQuickReviseBaseTime(index) + leftover;
}

export function calculateQuickReviseLeftover(
  elapsed: number,
  index: number,
  leftover = 0
): number {
  const base = calculateQuickReviseBaseTime(index);
  const startLeftover = leftover ? leftover / 2 : 0;
  return Math.max(0, base + startLeftover - elapsed);
}

export function buildQuickReviseQuestion(
  currentTerm: Term,
  allTerms: Term[]
): QuickReviseQuestion {
  const distractors = allTerms.filter((t) => t.id !== currentTerm.id);
  const selected =
    distractors.length < 3
      ? distractors
      : [...distractors].sort(() => Math.random() - 0.5).slice(0, 3);

  const options = [currentTerm.name as string, ...selected.map((d) => d.name as string)];
  options.sort(() => Math.random() - 0.5);

  return {
    progressId: currentTerm.learning_progress_id,
    question: currentTerm.meaning,
    answer: currentTerm.name,
    image: currentTerm.image,
    options,
    type: "quiz",
  };
}

export function isQuickReviseCorrect(
  userAnswer: string,
  correctAnswer: string
): boolean {
  return userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase();
}

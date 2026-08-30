import { shuffleArray } from "./array";
import { QUESTION_TYPES } from "./constants";
import type { Question, Term } from "./types";

// A multiple-choice question needs at least one wrong option to be worth
// answering. Tiny decks (a single term) simply get typing questions instead.
const MIN_DISTRACTORS = 1;

export function generateQuizQuestions(
  reviseTerms: Term[],
  allTerms: Term[]
): Question[] {
  // Shuffle terms array
  reviseTerms = shuffleArray(reviseTerms);

  const questions: Question[] = [];
  for (const term of reviseTerms) {
    // Get up to three random terms (excluding current term)
    const options = allTerms
      .filter((t) => t.id !== term.id && t.name !== term.name)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((t) => t.name as string);

    if (options.length < MIN_DISTRACTORS) continue;

    // Drop the correct answer in at a random position
    options.splice(
      Math.floor(Math.random() * (options.length + 1)),
      0,
      term.name as string
    );

    questions.push({
      type: QUESTION_TYPES.QUIZ,
      id: term.id,
      image: term.image,
      question: term.meaning,
      options,
      answer: term.name,
      progressId: term.learning_progress_id,
    });
  }

  return questions;
}

export function generateFillQuestions(terms: Term[]): Question[] {
  return terms.map((term) => ({
    type: QUESTION_TYPES.FILL,
    id: term.id,
    image: term.image,
    question: term.meaning,
    answer: term.name,
    progressId: term.learning_progress_id,
  }));
}

export function generateQuestions(
  reviseTerms: Term[],
  allTerms: Term[]
): Question[] {
  const quiz = generateQuizQuestions(reviseTerms, allTerms);
  const fill = generateFillQuestions(reviseTerms);
  const result = quiz.concat(fill);
  return shuffleArray(result);
}

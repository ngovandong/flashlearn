import { shuffleArray } from "@utils/array";
import { QUESTION_TYPES } from "@constants/questionTypes";

export function generateQuizQuestions(reviseTerms, allTerms) {
  // Shuffle terms array
  reviseTerms = shuffleArray(reviseTerms);

  // Create questions array
  const questions = reviseTerms.map((term) => {
    // Get three random terms (excluding current term)
    const randomTerms = allTerms
      .filter((t) => t.id !== term.id && t.name !== term.name)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    // Get options array (with current term as correct answer)
    const options = randomTerms.map((t) => t.name);
    options.splice(Math.floor(Math.random() * 4), 0, term.name);

    return {
      type: QUESTION_TYPES.QUIZ,
      id: term.id,
      image: term.image,
      question: term.meaning,
      options,
      answer: term.name,
      progressId: term.learning_progress_id,
    };
  });

  return questions;
}

export function generateFillQuestions(terms) {
  return terms.map((term) => ({
    type: QUESTION_TYPES.FILL,
    id: term.id,
    image: term.image,
    question: term.meaning,
    answer: term.name,
    progressId: term.learning_progress_id,
  }));
}

export function generateQuestions(reviseTerms, allTerms) {
  const quiz = generateQuizQuestions(reviseTerms, allTerms);
  const fill = generateFillQuestions(reviseTerms);
  const result = quiz.concat(fill);
  return shuffleArray(result);
}

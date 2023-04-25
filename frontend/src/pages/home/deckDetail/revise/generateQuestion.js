import { shuffleArray } from "@utils/array";

const { QUESTION_TYPES } = require("@constants/questionTypes");

export function generateQuizQuestions(terms) {
  // Shuffle terms array
  terms = shuffleArray(terms);

  // Create questions array
  const questions = terms.map((term) => {
    // Get three random terms (excluding current term)
    const randomTerms = terms
      .filter((t) => t.id !== term.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    // Get options array (with current term as correct answer)
    const options = randomTerms.map((t) => t.name);
    options.splice(Math.floor(Math.random() * 4), 0, term.name);

    return {
      type: QUESTION_TYPES.QUIZ,
      id: term.id,
      image: term.image,
      question: term.description,
      options,
      answer: term.name,
    };
  });

  return questions;
}

export function generateFillQuestions(terms) {
  return terms.map((term) => ({
    type: QUESTION_TYPES.FILL,
    id: term.id,
    image: term.image,
    question: term.description,
    answer: term.name,
  }));
}

export function generateQuestions(terms) {
  const quiz = generateQuizQuestions(terms);
  const fill = generateFillQuestions(terms);
  const result = quiz.concat(fill);
  return shuffleArray(result);
}

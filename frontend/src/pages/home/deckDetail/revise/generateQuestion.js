const { QUESTION_TYPES } = require("@constants/questionTypes");

export function generateQuestions(terms) {
  // Shuffle terms array
  terms = terms.sort(() => Math.random() - 0.5);

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

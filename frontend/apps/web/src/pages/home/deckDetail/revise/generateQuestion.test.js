import {
  generateQuestions,
  generateQuizQuestions,
  generateFillQuestions,
  QUESTION_TYPES,
} from "@flashlearn/core";

describe("generateQuestion", () => {
  // Fresh fixtures per test — generateQuizQuestions shuffles its input in place,
  // so sharing the arrays across tests would make ordering assertions flaky.
  const makeReviseTerms = () => [
    {
      id: "1",
      name: "apple",
      meaning: "A fruit",
      image: "",
      learning_progress_id: "lp1",
    },
    {
      id: "2",
      name: "banana",
      meaning: "Yellow fruit",
      image: "",
      learning_progress_id: "lp2",
    },
  ];

  const makeAllTerms = () => [
    ...makeReviseTerms(),
    { id: "3", name: "car", meaning: "Vehicle", image: "" },
    { id: "4", name: "dog", meaning: "Animal", image: "" },
    { id: "5", name: "egg", meaning: "Food", image: "" },
  ];

  test("generateQuizQuestions builds options with the correct answer", () => {
    const questions = generateQuizQuestions(makeReviseTerms(), makeAllTerms());
    expect(questions).toHaveLength(2);
    questions.forEach((q) => {
      expect(q.type).toBe(QUESTION_TYPES.QUIZ);
      expect(q.options).toContain(q.answer);
    });
  });

  test("generateFillQuestions maps term fields", () => {
    const questions = generateFillQuestions(makeReviseTerms());
    expect(questions[0]).toMatchObject({
      type: QUESTION_TYPES.FILL,
      answer: "apple",
      question: "A fruit",
      progressId: "lp1",
    });
  });

  test("generateQuestions merges quiz and fill types", () => {
    const reviseTerms = makeReviseTerms();
    const questions = generateQuestions(reviseTerms, makeAllTerms());
    const types = new Set(questions.map((q) => q.type));
    expect(types.has(QUESTION_TYPES.QUIZ)).toBe(true);
    expect(types.has(QUESTION_TYPES.FILL)).toBe(true);
    expect(questions.length).toBe(reviseTerms.length * 2);
  });
});

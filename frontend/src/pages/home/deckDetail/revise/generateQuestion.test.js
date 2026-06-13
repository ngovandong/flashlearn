import { generateQuestions, generateQuizQuestions, generateFillQuestions } from "./generateQuestion";
import { QUESTION_TYPES } from "@constants/questionTypes";

describe("generateQuestion", () => {
  const reviseTerms = [
    {
      id: "1",
      name: "apple",
      description: "A fruit",
      image: "",
      learning_progress_id: "lp1",
    },
    {
      id: "2",
      name: "banana",
      description: "Yellow fruit",
      image: "",
      learning_progress_id: "lp2",
    },
  ];

  const allTerms = [
    ...reviseTerms,
    { id: "3", name: "car", description: "Vehicle", image: "" },
    { id: "4", name: "dog", description: "Animal", image: "" },
    { id: "5", name: "egg", description: "Food", image: "" },
  ];

  test("generateQuizQuestions builds options with the correct answer", () => {
    const questions = generateQuizQuestions(reviseTerms, allTerms);
    expect(questions).toHaveLength(2);
    questions.forEach((q) => {
      expect(q.type).toBe(QUESTION_TYPES.QUIZ);
      expect(q.options).toContain(q.answer);
    });
  });

  test("generateFillQuestions maps term fields", () => {
    const questions = generateFillQuestions(reviseTerms);
    expect(questions[0]).toMatchObject({
      type: QUESTION_TYPES.FILL,
      answer: "apple",
      question: "A fruit",
      progressId: "lp1",
    });
  });

  test("generateQuestions merges quiz and fill types", () => {
    const questions = generateQuestions(reviseTerms, allTerms);
    const types = new Set(questions.map((q) => q.type));
    expect(types.has(QUESTION_TYPES.QUIZ)).toBe(true);
    expect(types.has(QUESTION_TYPES.FILL)).toBe(true);
    expect(questions.length).toBe(reviseTerms.length * 2);
  });
});

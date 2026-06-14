import {
  levenshtein,
  normalizeAnswer,
  buildVariants,
  checkAnswer,
  diffAnswer,
} from "./answerCheck";

describe("normalizeAnswer", () => {
  test("lowercases, trims and collapses whitespace", () => {
    expect(normalizeAnswer("  Hello   World ")).toBe("hello world");
  });
  test("strips punctuation and accents", () => {
    expect(normalizeAnswer("Café?!")).toBe("cafe");
  });
  test("drops a leading article", () => {
    expect(normalizeAnswer("The dog")).toBe("dog");
    expect(normalizeAnswer("the")).toBe("the");
  });
});

describe("levenshtein", () => {
  test("counts single-character edits", () => {
    expect(levenshtein("sentence", "sentences")).toBe(1);
    expect(levenshtein("color", "colour")).toBe(1);
    expect(levenshtein("abc", "abc")).toBe(0);
  });
});

describe("buildVariants", () => {
  test("splits alternatives and expands optional segments", () => {
    expect(buildVariants("color[s]")).toEqual(
      expect.arrayContaining(["colors", "color"])
    );
    expect(buildVariants("run / sprint")).toEqual(
      expect.arrayContaining(["run", "sprint"])
    );
  });
});

describe("checkAnswer", () => {
  test("exact match after normalization is correct", () => {
    expect(checkAnswer("hello", "Hello!").status).toBe("correct");
  });
  test("missing trailing punctuation still correct", () => {
    expect(checkAnswer("are you ready", "Are you ready?").isCorrect).toBe(true);
  });
  test("plural typo is accepted", () => {
    const res = checkAnswer("sentence", "sentences");
    expect(res.isCorrect).toBe(true);
    expect(res.status).toBe("accepted");
  });
  test("alternative answers are accepted", () => {
    expect(checkAnswer("sprint", "run / sprint").isCorrect).toBe(true);
  });
  test("clearly wrong answer is incorrect", () => {
    expect(checkAnswer("banana", "apple").isCorrect).toBe(false);
  });
  test("short answers must be exact", () => {
    expect(checkAnswer("car", "cat").isCorrect).toBe(false);
  });
  test("blank answer is incorrect", () => {
    expect(checkAnswer("", "apple").isCorrect).toBe(false);
  });
});

describe("diffAnswer", () => {
  test("marks the missing characters in the correct answer", () => {
    const { user, correct } = diffAnswer("sentence", "sentences");
    expect(user.every((seg) => seg.match)).toBe(true);
    expect(correct.some((seg) => !seg.match)).toBe(true);
  });
  test("marks extra/wrong characters the user typed", () => {
    const { user } = diffAnswer("apxle", "apple");
    expect(user.some((seg) => !seg.match)).toBe(true);
  });
});

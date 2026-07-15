import {
  buildGamePool,
  buildMcqQuestions,
  buildSynAntQuestions,
  buildImageQuestions,
  buildSentenceQuestions,
  simulateBotAnswer,
  ghostScoreAt,
  applyAnswer,
  comboMultiplier,
  initialComboState,
  timeBonus,
  BOT_PROFILES,
} from "@flashlearn/core";

const makeTerms = () => [
  {
    id: "1",
    name: "happy",
    meaning: "feeling joy",
    image: "https://img/happy.png",
    synonyms: ["glad", "cheerful"],
    antonyms: ["sad"],
    examples: ["She felt happy today."],
    word_forms: ["happier"],
  },
  {
    id: "2",
    name: "fast",
    meaning: "moving quickly",
    image: "https://img/fast.png",
    synonyms: ["quick"],
    antonyms: ["slow"],
    examples: ["The fast car won."],
  },
  {
    id: "3",
    name: "big",
    meaning: "large in size",
    image: "https://img/big.png",
    examples: ["A big house."],
  },
  {
    id: "4",
    name: "cold",
    meaning: "low temperature",
    image: "https://img/cold.png",
    antonyms: ["hot"],
  },
  { id: "5", name: "bright", meaning: "full of light" },
];

describe("buildGamePool", () => {
  test("filters out terms without a name or meaning", () => {
    const pool = buildGamePool([
      { id: "a", name: "x", meaning: "y" },
      { id: "b", name: "", meaning: "y" },
      { id: "c", name: "z" },
    ]);
    expect(pool.terms).toHaveLength(1);
  });

  test("reports availability flags from the data present", () => {
    const pool = buildGamePool(makeTerms());
    expect(pool.available.mcq).toBe(true); // >= 4 terms
    expect(pool.available.synAnt).toBe(true); // >= 3 with syn/ant
    expect(pool.available.images).toBe(true); // >= 4 with images
    expect(pool.available.examples).toBe(true); // >= 1 with examples
  });

  test("locks games when data is missing", () => {
    const pool = buildGamePool([
      { id: "1", name: "a", meaning: "m1" },
      { id: "2", name: "b", meaning: "m2" },
      { id: "3", name: "c", meaning: "m3" },
    ]);
    expect(pool.available.mcq).toBe(false); // < 4 terms
    expect(pool.available.synAnt).toBe(false);
    expect(pool.available.images).toBe(false);
    expect(pool.available.examples).toBe(false);
  });
});

describe("buildMcqQuestions", () => {
  test("each question has the answer among its options", () => {
    const questions = buildMcqQuestions(makeTerms(), 4);
    expect(questions).toHaveLength(4);
    for (const q of questions) {
      expect(q.options).toContain(q.answer);
      expect(q.prompt).toBeTruthy();
    }
  });
});

describe("buildSynAntQuestions", () => {
  test("only uses terms with synonyms or antonyms and labels them correctly", () => {
    const questions = buildSynAntQuestions(makeTerms());
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      const term = makeTerms().find((t) => t.id === q.id);
      const list = q.isSynonym ? term.synonyms : term.antonyms;
      expect(list).toContain(q.candidate);
    }
  });
});

describe("buildImageQuestions", () => {
  test("builds four-option image questions with the answer present", () => {
    const questions = buildImageQuestions(makeTerms());
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(q.options.map((o) => o.name)).toContain(q.answer);
    }
  });
});

describe("buildSentenceQuestions", () => {
  test("blanks the target word out of an example", () => {
    const questions = buildSentenceQuestions(makeTerms());
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      expect(q.sentence).toContain("_____");
      expect(q.sentence.toLowerCase()).not.toContain(q.answer.toLowerCase());
    }
  });
});

describe("bot + ghost", () => {
  test("bot answer stays within its difficulty delay range", () => {
    const profile = BOT_PROFILES.medium;
    for (let i = 0; i < 50; i++) {
      const { correct, delayMs } = simulateBotAnswer("medium");
      expect(typeof correct).toBe("boolean");
      expect(delayMs).toBeGreaterThanOrEqual(profile.minDelayMs);
      expect(delayMs).toBeLessThanOrEqual(profile.maxDelayMs);
    }
  });

  test("ghost climbs linearly to the best score", () => {
    expect(ghostScoreAt(0, 1000, 20)).toBe(0);
    expect(ghostScoreAt(500, 1000, 20)).toBe(10);
    expect(ghostScoreAt(2000, 1000, 20)).toBe(20); // clamped
  });
});

describe("scoring", () => {
  test("multiplier grows every three correct answers, capped at 4", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(3)).toBe(2);
    expect(comboMultiplier(9)).toBe(4);
    expect(comboMultiplier(30)).toBe(4);
  });

  test("a wrong answer resets the streak but keeps the score", () => {
    let state = initialComboState();
    state = applyAnswer(state, true);
    expect(state).toEqual({ streak: 1, score: 10 });
    const afterWrong = applyAnswer(state, false);
    expect(afterWrong).toEqual({ streak: 0, score: 10 });
  });

  test("time bonus is proportional to remaining time", () => {
    expect(timeBonus(6000, 6000)).toBe(10);
    expect(timeBonus(3000, 6000)).toBe(5);
    expect(timeBonus(0, 6000)).toBe(0);
  });
});

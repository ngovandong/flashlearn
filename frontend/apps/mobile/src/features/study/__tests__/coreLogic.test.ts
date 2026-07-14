import {
  buildQuickReviseQuestion,
  calculateQuickReviseBaseTime,
  isQuickReviseCorrect,
  evaluateDictation,
  overallDictationScore,
  mapReminderRoute,
  type Term,
} from "@flashlearn/core";

describe("quickRevise core logic", () => {
  it("calculates decreasing base time", () => {
    expect(calculateQuickReviseBaseTime(0)).toBe(10);
    expect(calculateQuickReviseBaseTime(4)).toBe(2);
  });

  it("builds quiz options including the answer", () => {
    const current: Term = { id: "1", name: "apple", meaning: "quả táo" };
    const all: Term[] = [
      current,
      { id: "2", name: "banana", meaning: "chuối" },
      { id: "3", name: "orange", meaning: "cam" },
      { id: "4", name: "grape", meaning: "nho" },
    ];
    const q = buildQuickReviseQuestion(current, all);
    expect(q.options).toContain("apple");
  });

  it("checks answers case-insensitively", () => {
    expect(isQuickReviseCorrect("Apple", "apple")).toBe(true);
  });
});

describe("dictation core logic", () => {
  it("scores exact matches", () => {
    const result = evaluateDictation(["Hello", "world"], "Hello world");
    expect(result.score).toBe(100);
  });

  it("aggregates line scores", () => {
    expect(
      overallDictationScore([
        { correct: 2, total: 2 },
        { correct: 1, total: 2 },
      ])
    ).toBe(75);
  });
});

describe("reminder route mapping", () => {
  it("maps deck routes to library paths", () => {
    expect(mapReminderRoute("/deck/abc/learn")).toBe("/library/abc/learn");
  });

  it("maps mixed revise", () => {
    expect(mapReminderRoute("/revise")).toBe("/revise");
  });
});

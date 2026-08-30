import {
  parseTermLines,
  countSkippedTermLines,
  formatTermLines,
} from "@flashlearn/core";

describe("parseTermLines", () => {
  test("splits on dashes, equals signs, commas and tabs", () => {
    expect(
      parseTermLines("apple - quả táo\nrun = chạy\nhouse,ngôi nhà\ncat\tcon mèo")
    ).toEqual([
      { name: "apple", meaning: "quả táo" },
      { name: "run", meaning: "chạy" },
      { name: "house", meaning: "ngôi nhà" },
      { name: "cat", meaning: "con mèo" },
    ]);
  });

  test("keeps a line without a separator as a term with no meaning", () => {
    expect(parseTermLines("flickering")).toEqual([
      { name: "flickering", meaning: "" },
    ]);
  });

  test("prefers the spaced dash over a comma inside the meaning", () => {
    expect(parseTermLines("irrelevant - not related, off topic")).toEqual([
      { name: "irrelevant", meaning: "not related, off topic" },
    ]);
  });

  test("drops blank lines and repeated names", () => {
    expect(parseTermLines("apple - táo\n\nAPPLE - táo again")).toEqual([
      { name: "apple", meaning: "táo" },
    ]);
  });

  test("keeps repeated names when dedupe is off", () => {
    expect(parseTermLines("apple - a\napple - b", { dedupe: false })).toHaveLength(2);
  });
});

describe("countSkippedTermLines", () => {
  test("counts the lines parsing threw away", () => {
    expect(countSkippedTermLines("apple - táo\nAPPLE - táo\n\n")).toBe(1);
  });
});

describe("formatTermLines", () => {
  test("round-trips through parseTermLines", () => {
    const terms = [
      { name: "apple", meaning: "quả táo" },
      { name: "flickering", meaning: "" },
    ];
    expect(parseTermLines(formatTermLines(terms), { dedupe: false })).toEqual(terms);
  });
});

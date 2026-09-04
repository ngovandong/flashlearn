import {
  sameSpeaker,
  uniqueSpeakers,
  speakerAlign,
  initials,
} from "./speakerRoles";

describe("sameSpeaker", () => {
  test("ignores case and surrounding whitespace", () => {
    expect(sameSpeaker("Tom", "tom")).toBe(true);
    expect(sameSpeaker(" Dong ", "Dong")).toBe(true);
    expect(sameSpeaker("John", "Dong")).toBe(false);
  });
});

describe("uniqueSpeakers", () => {
  test("keeps first-seen spelling and drops later case variants", () => {
    expect(
      uniqueSpeakers([
        { speaker: "Dong" },
        { speaker: "John" },
        { speaker: "dong" },
        { speaker: "  John  " },
      ])
    ).toEqual(["Dong", "John"]);
  });

  test("skips empty speaker names", () => {
    expect(uniqueSpeakers([{ speaker: "" }, { speaker: "Sophie" }])).toEqual(["Sophie"]);
  });
});

describe("speakerAlign", () => {
  const speakers = ["Dong", "John"];

  test("puts the first speaker on the left and the rest on the right", () => {
    expect(speakerAlign("Dong", speakers)).toBe("left");
    expect(speakerAlign("John", speakers)).toBe("right");
    expect(speakerAlign("john", speakers)).toBe("right");
  });

  test("defaults unknown speakers to the left", () => {
    expect(speakerAlign("Stranger", speakers)).toBe("left");
  });
});

describe("initials", () => {
  test("uses the first letter of the name", () => {
    expect(initials("Dong")).toBe("D");
    expect(initials("")).toBe("?");
  });
});

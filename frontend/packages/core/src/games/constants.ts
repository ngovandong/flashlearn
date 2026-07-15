// Competition mini-game catalog + bot difficulty presets.
// Platform-agnostic: consumed by both the web and native Competition UIs.

export const GAME_KEYS = {
  RACE: "race",
  BLASTER: "blaster",
  TUG: "tug",
  TOWER: "tower",
  PICTURE: "picture",
  SENTENCE: "sentence",
  BUZZER: "buzzer",
} as const;

export type GameKey = (typeof GAME_KEYS)[keyof typeof GAME_KEYS];

// What term data a game needs before it can be played.
export type GameRequirement = "none" | "synAnt" | "images" | "examples";

export interface GameMeta {
  key: GameKey;
  title: string;
  tagline: string;
  // Icon hint; each platform maps it to its own icon set.
  icon: string;
  requires: GameRequirement;
  // Accent token key so each platform can tint the card consistently.
  accent: "primary" | "accent" | "accent2";
}

export const GAMES: GameMeta[] = [
  {
    key: GAME_KEYS.RACE,
    title: "Vocab Grand Prix",
    tagline: "Fuel your car by matching meanings faster than the bots.",
    icon: "race",
    requires: "none",
    accent: "primary",
  },
  {
    key: GAME_KEYS.BLASTER,
    title: "Meaning Blaster",
    tagline: "Shoot the falling word that matches the meaning.",
    icon: "blaster",
    requires: "none",
    accent: "accent",
  },
  {
    key: GAME_KEYS.TUG,
    title: "Synonym Tug-of-War",
    tagline: "Synonym or antonym? Pull the rope to your side.",
    icon: "tug",
    requires: "synAnt",
    accent: "accent2",
  },
  {
    key: GAME_KEYS.TOWER,
    title: "Word Tower",
    tagline: "Stack blocks by answering fast. Beat your ghost.",
    icon: "tower",
    requires: "none",
    accent: "primary",
  },
  {
    key: GAME_KEYS.PICTURE,
    title: "Picture Rush",
    tagline: "Tap the picture that matches the word.",
    icon: "picture",
    requires: "images",
    accent: "accent",
  },
  {
    key: GAME_KEYS.SENTENCE,
    title: "Sentence Sniper",
    tagline: "Fill the blank in the example sentence.",
    icon: "sentence",
    requires: "examples",
    accent: "accent2",
  },
  {
    key: GAME_KEYS.BUZZER,
    title: "Bot Buzzer",
    tagline: "Buzz in before the bot to steal the point.",
    icon: "buzzer",
    requires: "none",
    accent: "primary",
  },
];

export function getGameMeta(key: GameKey): GameMeta | undefined {
  return GAMES.find((g) => g.key === key);
}

export type Difficulty = "easy" | "medium" | "hard";

export interface BotProfile {
  // Probability the bot answers correctly (0..1).
  accuracy: number;
  // Range of think-time before the bot commits an answer.
  minDelayMs: number;
  maxDelayMs: number;
}

export const BOT_PROFILES: Record<Difficulty, BotProfile> = {
  easy: { accuracy: 0.55, minDelayMs: 1700, maxDelayMs: 3400 },
  medium: { accuracy: 0.72, minDelayMs: 1100, maxDelayMs: 2400 },
  hard: { accuracy: 0.86, minDelayMs: 650, maxDelayMs: 1600 },
};

// Minimum term counts required for a game to be offered on a deck.
export const MIN_TERMS_FOR_MCQ = 4;
export const MIN_TERMS_FOR_IMAGE = 4;
export const MIN_TERMS_FOR_SYN_ANT = 3;
export const MIN_TERMS_FOR_SENTENCE = 1;

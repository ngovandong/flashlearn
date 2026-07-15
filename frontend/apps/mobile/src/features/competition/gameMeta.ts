import type { GamePoolAvailability, GameRequirement } from "@flashlearn/core";

// MaterialIcons name per game (used by @expo/vector-icons / Paper icons).
export const GAME_ICONS: Record<string, string> = {
  race: "flag-checkered",
  blaster: "target",
  tug: "swap-horizontal",
  tower: "layers",
  picture: "image-search",
  sentence: "form-textbox",
  buzzer: "flash",
};

const REQUIREMENT_FLAG: Record<GameRequirement, keyof GamePoolAvailability> = {
  none: "mcq",
  synAnt: "synAnt",
  images: "images",
  examples: "examples",
};

const REQUIREMENT_REASON: Record<GameRequirement, string> = {
  none: "Add at least 4 terms to play.",
  synAnt: "This deck needs terms with synonyms or antonyms.",
  images: "This deck needs at least 4 terms with images.",
  examples: "This deck needs terms with example sentences.",
};

export function isGameUnlocked(
  requires: GameRequirement,
  available: GamePoolAvailability
): boolean {
  return available[REQUIREMENT_FLAG[requires]];
}

export function requirementReason(requires: GameRequirement): string {
  return REQUIREMENT_REASON[requires];
}

import type { ComponentType } from "react";
import type { GameProps } from "../types";
import Race from "./race";
import Blaster from "./blaster";
import Tug from "./tug";
import Tower from "./tower";
import Picture from "./picture";
import Sentence from "./sentence";
import Buzzer from "./buzzer";

export const GAME_COMPONENTS: Record<string, ComponentType<GameProps>> = {
  race: Race,
  blaster: Blaster,
  tug: Tug,
  tower: Tower,
  picture: Picture,
  sentence: Sentence,
  buzzer: Buzzer,
};

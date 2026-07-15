import type { GamePool } from "@flashlearn/core";
import type { GameSound } from "./useGameSound";

export interface GameProps {
  pool: GamePool;
  best: number;
  sound: GameSound;
  onScore: (score: number) => void;
  onGameOver: (finalScore: number) => void;
}

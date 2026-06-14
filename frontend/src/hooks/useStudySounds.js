import { useMemo } from "react";

export function useStudySounds() {
  return useMemo(
    () => ({
      correct: new Audio(`${process.env.PUBLIC_URL}/sound/true.mp3`),
      incorrect: new Audio(`${process.env.PUBLIC_URL}/sound/false.mp3`),
      finish: new Audio(`${process.env.PUBLIC_URL}/sound/congratulation.mp3`),
    }),
    []
  );
}

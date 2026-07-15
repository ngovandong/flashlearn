import { useMemo } from "react";

export function useStudySounds() {
  return useMemo(
    () => ({
      correct: new Audio(`${import.meta.env.BASE_URL}sound/true.mp3`),
      incorrect: new Audio(`${import.meta.env.BASE_URL}sound/false.mp3`),
      finish: new Audio(`${import.meta.env.BASE_URL}sound/congratulation.mp3`),
    }),
    []
  );
}

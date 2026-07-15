import { useCallback, useRef, useState } from "react";
import { useStudySounds } from "@hooks/useStudySounds";
import { speak } from "@api-services/voiceService";

const STORAGE_KEY = "competition_muted";

// One sound controller shared by the shell (mute toggle) and the active game.
export function useGameSound() {
  const sounds = useStudySounds();
  const [muted, setMuted] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "1"
  );
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const play = useCallback(
    (clip) => {
      if (mutedRef.current || !clip) return;
      try {
        clip.currentTime = 0;
        clip.play().catch(() => {});
      } catch {
        /* ignore autoplay errors */
      }
    },
    []
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const say = useCallback((text) => {
    if (mutedRef.current || !text) return;
    speak(text).catch(() => {});
  }, []);

  return {
    muted,
    toggleMute,
    say,
    playCorrect: () => play(sounds.correct),
    playWrong: () => play(sounds.incorrect),
    playFinish: () => play(sounds.finish),
  };
}

import { useCallback, useMemo, useRef, useState } from "react";
import { speak } from "@api-services/voiceService";
import { sfx } from "./sfx";

const STORAGE_KEY = "competition_muted";

// One sound controller shared by the shell (mute toggle) and the active game.
// All effects are synthesized (see sfx.js) so there are no audio assets.
export function useGameSound() {
  const [muted, setMuted] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "1"
  );
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const gate = useCallback((fn) => (...args) => {
    if (mutedRef.current) return;
    try {
      fn(...args);
    } catch {
      /* audio is best-effort */
    }
  }, []);

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

  return useMemo(
    () => ({
      muted,
      toggleMute,
      say,
      unlock: () => sfx.unlock(),
      playCorrect: gate(sfx.correct),
      playWrong: gate(sfx.wrong),
      playShoot: gate(sfx.shoot),
      playExplode: gate(sfx.explode),
      playCombo: gate(sfx.combo),
      playBoost: gate(sfx.boost),
      playBeep: gate(sfx.beep),
      playFinish: gate(sfx.win),
    }),
    [muted, toggleMute, say, gate]
  );
}

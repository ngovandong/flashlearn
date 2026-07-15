import { useCallback, useRef, useState } from "react";
import { speakText } from "@/utils/audio";

export interface GameSound {
  muted: boolean;
  toggleMute: () => void;
  say: (text?: string) => void;
}

// Mobile has no bundled SFX, so the sound controller just gates text-to-speech
// (the answer word) behind a mute toggle shared by the shell and the games.
export function useGameSound(): GameSound {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  const toggleMute = useCallback(() => setMuted((m) => !m), []);
  const say = useCallback((text?: string) => {
    if (mutedRef.current || !text) return;
    speakText(text).catch(() => {});
  }, []);

  return { muted, toggleMute, say };
}

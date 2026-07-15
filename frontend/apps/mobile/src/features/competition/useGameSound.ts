import { useCallback, useMemo, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { speakText } from "@/utils/audio";

export interface GameSound {
  muted: boolean;
  toggleMute: () => void;
  say: (text?: string) => void;
  unlock: () => void;
  playCorrect: () => void;
  playWrong: () => void;
  playShoot: () => void;
  playExplode: () => void;
  playCombo: (mult?: number) => void;
  playBoost: () => void;
  playBeep: (high?: boolean) => void;
  playFinish: () => void;
}

// RN has no Web Audio, so SFX are expressed as haptic patterns (plus TTS for the
// answer word). Everything is gated behind the shared mute toggle.
export function useGameSound(): GameSound {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const say = useCallback((text?: string) => {
    if (mutedRef.current || !text) return;
    speakText(text).catch(() => {});
  }, []);

  const buzz = useCallback((fn: () => Promise<void>) => {
    if (mutedRef.current) return;
    fn().catch(() => {});
  }, []);

  return useMemo(
    () => ({
      muted,
      toggleMute,
      say,
      unlock: () => {},
      playCorrect: () =>
        buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
      playWrong: () =>
        buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
      playShoot: () => buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
      playExplode: () => buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
      playCombo: () => buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
      playBoost: () => buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
      playBeep: () => buzz(() => Haptics.selectionAsync()),
      playFinish: () =>
        buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
    }),
    [muted, toggleMute, say, buzz]
  );
}

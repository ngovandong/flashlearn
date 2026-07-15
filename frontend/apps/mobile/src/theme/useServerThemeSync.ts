import { useEffect, useRef } from "react";
import {
  MODES,
  PALETTE_MAP,
  SURFACES,
  type ThemeMode,
  type ThemeSurface,
} from "@flashlearn/core";
import { userSettingsApi } from "@/api/services";
import { useAppSelector } from "@/store/hooks";
import { selectToken } from "@/store/authSlice";
import { useAppTheme } from "@/theme/ThemeProvider";

/**
 * Loads the user's saved theme (mode + palette) from the server once per
 * session after they are authenticated, so the preference follows them across
 * devices. Local AsyncStorage still provides the instant, offline-first value;
 * this reconciles it with the server on login.
 */
export function useServerThemeSync() {
  const token = useAppSelector(selectToken);
  const { setMode, setPalette, setSurface } = useAppTheme();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!token || syncedRef.current) return;
    syncedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const settings = await userSettingsApi.getSettings();
        if (cancelled || !settings) return;
        const mode = settings.theme_mode;
        const palette = settings.theme_palette;
        const surface = settings.theme_surface;
        if (mode && MODES.includes(mode as ThemeMode)) {
          setMode(mode as ThemeMode);
        }
        if (palette && PALETTE_MAP[palette]) {
          setPalette(palette);
        }
        if (surface && SURFACES.includes(surface as ThemeSurface)) {
          setSurface(surface as ThemeSurface);
        }
      } catch {
        // Non-fatal: fall back to the locally stored theme.
        syncedRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, setMode, setPalette, setSurface]);
}

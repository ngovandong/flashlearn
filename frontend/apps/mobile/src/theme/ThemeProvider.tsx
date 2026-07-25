import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PaperProvider } from "react-native-paper";
import { ThemeProvider as NavThemeProvider } from "expo-router";
import {
  DEFAULT_MODE,
  DEFAULT_PALETTE,
  DEFAULT_SURFACE,
  resolveMode,
  resolveSurface,
  type ThemeMode,
  type ThemeSurface,
} from "@flashlearn/core";
import { buildNavigationTheme, buildPaperTheme } from "@/theme/mapping";

const MODE_KEY = "fl_theme_mode";
const PALETTE_KEY = "fl_theme_palette";
const SURFACE_KEY = "fl_theme_surface";

interface ThemeContextValue {
  mode: ThemeMode;
  palette: string;
  surface: ThemeSurface;
  resolvedMode: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: string) => void;
  setSurface: (surface: ThemeSurface) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useAppTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return value;
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);
  const [palette, setPaletteState] = useState<string>(DEFAULT_PALETTE);
  const [surface, setSurfaceState] = useState<ThemeSurface>(DEFAULT_SURFACE);

  useEffect(() => {
    (async () => {
      const [storedMode, storedPalette, storedSurface] = await Promise.all([
        AsyncStorage.getItem(MODE_KEY),
        AsyncStorage.getItem(PALETTE_KEY),
        AsyncStorage.getItem(SURFACE_KEY),
      ]);
      if (storedMode) setModeState(storedMode as ThemeMode);
      if (storedPalette) setPaletteState(storedPalette);
      if (storedSurface) setSurfaceState(resolveSurface(storedSurface));
    })();
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  };

  const setPalette = (next: string) => {
    setPaletteState(next);
    AsyncStorage.setItem(PALETTE_KEY, next).catch(() => {});
  };

  const setSurface = (next: ThemeSurface) => {
    setSurfaceState(next);
    AsyncStorage.setItem(SURFACE_KEY, next).catch(() => {});
  };

  const resolvedMode = resolveMode(mode, system === "dark");

  const paperTheme = useMemo(
    () => buildPaperTheme(palette, resolvedMode),
    [palette, resolvedMode]
  );
  const navTheme = useMemo(
    () => buildNavigationTheme(palette, resolvedMode),
    [palette, resolvedMode]
  );

  const value = useMemo(
    () => ({ mode, palette, surface, resolvedMode, setMode, setPalette, setSurface }),
    [mode, palette, surface, resolvedMode]
  );

  return (
    <ThemeContext.Provider value={value}>
      <PaperProvider theme={paperTheme}>
        <NavThemeProvider value={navTheme}>{children}</NavThemeProvider>
      </PaperProvider>
    </ThemeContext.Provider>
  );
}

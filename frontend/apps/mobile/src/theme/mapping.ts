import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from "react-native-paper";
import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavDefaultTheme,
} from "expo-router";
import { NEUTRALS, getPalette } from "@flashlearn/core";

const SEMANTIC_ERROR = "#e5484d";
type NavigationTheme = typeof NavDefaultTheme;

/**
 * Map a FlashLearn core palette + resolved light/dark mode onto a React Native
 * Paper MD3 theme. Pure function so it can be unit-tested without native code.
 */
export function buildPaperTheme(
  paletteId: string,
  resolvedMode: "light" | "dark"
): MD3Theme {
  const palette = getPalette(paletteId);
  const n = NEUTRALS[resolvedMode];
  const base = resolvedMode === "dark" ? MD3DarkTheme : MD3LightTheme;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.primary,
      onPrimary: palette.onPrimary,
      primaryContainer: palette.primarySoft,
      onPrimaryContainer: palette.primaryDark,
      secondary: palette.accent,
      onSecondary: "#ffffff",
      tertiary: palette.accent2,
      background: n.bg,
      surface: n.surface,
      surfaceVariant: n.surface2,
      onSurface: n.text,
      onSurfaceVariant: n.textMinor,
      onBackground: n.text,
      outline: n.borderStrong,
      outlineVariant: n.border,
      error: SEMANTIC_ERROR,
    },
  };
}

/** Matching React Navigation theme so headers/tab bars follow the palette. */
export function buildNavigationTheme(
  paletteId: string,
  resolvedMode: "light" | "dark"
): NavigationTheme {
  const palette = getPalette(paletteId);
  const n = NEUTRALS[resolvedMode];
  const base = resolvedMode === "dark" ? NavDarkTheme : NavDefaultTheme;

  return {
    ...base,
    dark: resolvedMode === "dark",
    colors: {
      ...base.colors,
      primary: palette.primary,
      background: n.bg,
      card: n.surface,
      text: n.text,
      border: n.border,
      notification: palette.accent,
    },
  };
}

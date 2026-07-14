import { createTheme } from "@mui/material";
import {
  DEFAULT_MODE,
  DEFAULT_PALETTE,
  NEUTRALS,
  THEME_STORAGE_KEY,
  getPalette,
  rgbTriplet,
} from "@constants/themes";

/** Resolve "system" to a concrete "light" | "dark" using the OS preference. */
export function resolveMode(mode) {
  if (mode === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "light";
  }
  return mode === "dark" ? "dark" : "light";
}

/** Compute the full set of CSS custom property values for a theme selection. */
export function computeVars(mode, paletteId) {
  const resolved = resolveMode(mode);
  const neutral = NEUTRALS[resolved];
  const palette = getPalette(paletteId);

  return {
    resolved,
    palette,
    neutral,
    vars: {
      "--fl-primary": palette.primary,
      "--fl-primary-rgb": rgbTriplet(palette.primary),
      "--fl-primary-dark": palette.primaryDark,
      "--fl-primary-hover": palette.primaryHover,
      "--fl-primary-soft": palette.primarySoft,
      "--fl-on-primary": palette.onPrimary,
      "--fl-gradient": `linear-gradient(135deg, ${palette.gradient[0]} 0%, ${palette.gradient[1]} 100%)`,

      // Harmonious accent group (secondary + tertiary).
      "--fl-accent": palette.accent,
      "--fl-accent-rgb": rgbTriplet(palette.accent),
      "--fl-accent-strong": palette.accentStrong,
      "--fl-accent-2": palette.accent2,
      "--fl-accent-2-rgb": rgbTriplet(palette.accent2),
      "--fl-accent-2-strong": palette.accent2Strong,

      // Logo hue rotation so the brand mark matches the active palette.
      "--fl-logo-rotate": `${palette.logoRotate}deg`,

      "--fl-bg": neutral.bg,
      "--fl-surface": neutral.surface,
      "--fl-surface-2": neutral.surface2,
      "--fl-text": neutral.text,
      "--fl-text-minor": neutral.textMinor,
      "--fl-text-muted": neutral.textMuted,
      "--fl-border": neutral.border,
      "--fl-border-strong": neutral.borderStrong,
    },
  };
}

/** Write the theme to the document root so the whole UI re-themes instantly. */
export function applyTheme(mode, paletteId) {
  if (typeof document === "undefined") return;
  const { resolved, vars } = computeVars(mode, paletteId);
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}

/** Build a MUI theme that matches the active palette + mode. */
export function buildMuiTheme(mode, paletteId) {
  const resolved = resolveMode(mode);
  const neutral = NEUTRALS[resolved];
  const palette = getPalette(paletteId);

  return createTheme({
    palette: {
      mode: resolved,
      primary: { main: palette.primary, contrastText: palette.onPrimary },
      purple: { main: palette.primary, contrastText: palette.onPrimary },
      white: {
        main: neutral.surface,
        dark: palette.primary,
        contrastText: neutral.text,
      },
      yellow: { main: palette.accent2 },
      grey: { main: "#ccc" },
      blue: { main: palette.accent, light: "#ffffff", contrastText: "#ffffff" },
      background: { default: neutral.bg, paper: neutral.surface },
      text: { primary: neutral.text, secondary: neutral.textMinor },
      divider: neutral.border,
    },
  });
}

/* --------------------------------------------------------------- persistence */

export function readStoredTheme() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        mode: parsed.mode || DEFAULT_MODE,
        palette: parsed.palette || DEFAULT_PALETTE,
      };
    }
  } catch {
    /* ignore malformed cache */
  }
  return { mode: DEFAULT_MODE, palette: DEFAULT_PALETTE };
}

export function writeStoredTheme(mode, palette) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ mode, palette }));
  } catch {
    /* storage may be unavailable (private mode) */
  }
}

/** Subscribe to OS color-scheme changes. Returns an unsubscribe function. */
export function watchSystem(callback) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => callback();
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

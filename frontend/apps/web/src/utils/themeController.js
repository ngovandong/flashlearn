import { createTheme } from "@mui/material";
import {
  NOTE_COLORS,
  resolveNoteColor,
  resolveNoteHighlight,
} from "@flashlearn/core";
import {
  DEFAULT_MODE,
  DEFAULT_PALETTE,
  DEFAULT_SURFACE,
  NEUTRALS,
  THEME_STORAGE_KEY,
  getPalette,
  rgbTriplet,
  resolveSurface,
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

/** Flat card shadow — mirrors `$shadow-sm` so solid mode is byte-identical. */
const FLAT_CARD_SHADOW =
  "0 1px 2px rgba(40, 46, 62, 0.04), 0 1px 3px rgba(40, 46, 62, 0.06)";

/**
 * Translucent "Liquid Glass" overrides for the neutral surface tokens + the
 * frost/shadow vars the `card` mixin reads. Because the base neutrals are
 * written inline on `:root`, these overrides must also be produced here (an
 * inline value can't be beaten by a stylesheet rule).
 */
function glassVars(resolved) {
  if (resolved === "dark") {
    return {
      // Barely-there tint — the heavy blur behind carries the look, iOS-style.
      "--fl-surface": "rgba(40, 46, 60, 0.28)",
      "--fl-surface-2": "rgba(50, 57, 74, 0.20)",
      "--fl-border": "rgba(255, 255, 255, 0.18)",
      "--fl-border-strong": "rgba(255, 255, 255, 0.28)",
      "--fl-glass-backdrop": "saturate(190%) blur(32px)",
      // Bright specular rim (top edge + full-perimeter hairline) + float shadow.
      "--fl-card-shadow":
        "inset 0 1.5px 1px rgba(255, 255, 255, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.10), inset 0 -14px 26px rgba(255, 255, 255, 0.04), 0 16px 44px rgba(0, 0, 0, 0.52)",
    };
  }
  return {
    "--fl-surface": "rgba(255, 255, 255, 0.20)",
    "--fl-surface-2": "rgba(255, 255, 255, 0.12)",
    "--fl-border": "rgba(255, 255, 255, 0.55)",
    "--fl-border-strong": "rgba(255, 255, 255, 0.75)",
    "--fl-glass-backdrop": "saturate(190%) blur(32px)",
    "--fl-card-shadow":
      "inset 0 1.5px 1px rgba(255, 255, 255, 0.95), inset 0 0 0 1px rgba(255, 255, 255, 0.45), inset 0 -14px 26px rgba(255, 255, 255, 0.18), 0 16px 44px rgba(15, 23, 42, 0.20)",
  };
}

/**
 * Text/highlight colors for study notes, keyed by palette name.
 *
 * Notes store a color *name* rather than a CSS value so the same document reads
 * correctly in both modes; the hues themselves live in `@flashlearn/core` so the
 * Expo app resolves the identical set.
 */
function noteVars(resolved) {
  return NOTE_COLORS.reduce(
    (vars, color) => ({
      ...vars,
      [`--fl-note-${color}`]: resolveNoteColor(color, resolved),
      [`--fl-note-${color}-wash`]: resolveNoteHighlight(color, resolved),
    }),
    {}
  );
}

/** Compute the full set of CSS custom property values for a theme selection. */
export function computeVars(mode, paletteId, surface) {
  const resolved = resolveMode(mode);
  const neutral = NEUTRALS[resolved];
  const palette = getPalette(paletteId);
  const glass = resolveSurface(surface) === "glass";

  const base = {
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

      // Solid defaults for the glass-aware card vars; overridden below in glass.
      "--fl-glass-backdrop": "none",
      "--fl-card-shadow": FLAT_CARD_SHADOW,

      ...noteVars(resolved),
  };

  const vars = glass ? { ...base, ...glassVars(resolved) } : base;

  return { resolved, palette, neutral, glass, vars };
}

/** Write the theme to the document root so the whole UI re-themes instantly. */
export function applyTheme(mode, paletteId, surface) {
  if (typeof document === "undefined") return;
  const { resolved, vars } = computeVars(mode, paletteId, surface);
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  root.dataset.theme = resolved;
  // The surface material (solid | glass) is a global attribute the SCSS keys off
  // to swap every surface between opaque and the translucent "Liquid Glass" look.
  root.dataset.material = resolveSurface(surface);
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
        surface: resolveSurface(parsed.surface),
      };
    }
  } catch {
    /* ignore malformed cache */
  }
  return { mode: DEFAULT_MODE, palette: DEFAULT_PALETTE, surface: DEFAULT_SURFACE };
}

export function writeStoredTheme(mode, palette, surface) {
  try {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ mode, palette, surface: resolveSurface(surface) })
    );
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

import { useMemo } from "react";
import { Easing, type EasingFunction, type ViewStyle } from "react-native";
import { getPalette, NEUTRALS, rgbTriplet, type Neutral, type Palette } from "@flashlearn/core";
import { useAppTheme } from "@/theme/ThemeProvider";

/**
 * Shared motion language for the app. All custom animations are built on the RN
 * `Animated` API (native driver, no Reanimated plugin), so these are plain
 * numbers / easing fns / spring configs consumed directly by `Animated.timing`
 * and `Animated.spring`. Keep durations short and easing snappy so the UI feels
 * responsive rather than sluggish.
 */
export const motion: {
  duration: { instant: number; fast: number; normal: number; slow: number };
  easing: { standard: EasingFunction; entrance: EasingFunction; emphasized: EasingFunction };
  spring: {
    press: { speed: number; bounciness: number };
    gentle: { speed: number; bounciness: number };
    bouncy: { speed: number; bounciness: number };
  };
  /** Per-item delay increments for staggered entrances. */
  stagger: { list: number; section: number };
} = {
  duration: { instant: 120, fast: 180, normal: 320, slow: 480 },
  easing: {
    standard: Easing.out(Easing.cubic),
    entrance: Easing.out(Easing.cubic),
    emphasized: Easing.bezier(0.2, 0, 0, 1),
  },
  spring: {
    press: { speed: 40, bounciness: 6 },
    gentle: { speed: 20, bounciness: 8 },
    bouncy: { speed: 14, bounciness: 12 },
  },
  stagger: { list: 50, section: 60 },
};

/** A soft/vivid color pairing used for the colorful feature tiles. */
export interface FeatureColor {
  /** Vivid foreground color for the icon / accents. */
  fg: string;
  /** Translucent tint used behind the icon. */
  tint: string;
}

/**
 * Fixed, cohesive accent hues keyed by the abstract icon name used across the
 * app (see `@flashlearn/core` reminder metadata + practice hub). This mirrors
 * the web app's colorful icon tiles so every feature reads at a glance.
 */
const FEATURE_HUES: Record<string, string> = {
  "auto-awesome": "#8b5cf6", // mixed revise — violet
  casino: "#8b5cf6", // revise round — violet
  "record-voice-over": "#10b981", // speaking — emerald
  forum: "#0ea5e9", // conversation — sky
  "edit-note": "#f43f5e", // writing — rose
  "history-edu": "#f43f5e", // writing revise — rose
  headphones: "#06b6d4", // listening — cyan
  hearing: "#06b6d4", // number listening — cyan
  "menu-book": "#f59e0b", // course / grammar — amber
  spellcheck: "#f59e0b", // grammar — amber
  style: "#4255ff", // deck — indigo
  "local-fire-department": "#f97316", // streak — orange
  school: "#8b5cf6", // learn — violet
  "auto-stories": "#f59e0b", // revise — amber
  bolt: "#06b6d4", // quick revise — cyan
  "emoji-events": "#f97316", // competition — orange
};

const DEFAULT_HUE = "#4255ff";

export interface GlassTokens {
  /** Whether Liquid Glass is the active surface material. */
  enabled: boolean;
  /** expo-blur tint ("light" | "dark") matching the resolved mode. */
  tint: "light" | "dark";
  /** Blur intensity for elevated surfaces. */
  intensity: number;
  /** Very light translucent overlay drawn over the blur to tune contrast. */
  overlay: string;
  /** Bright frosted hairline border color (specular rim). */
  border: string;
  /** Top specular sheen — [bright, transparent] gradient stops. */
  sheen: [string, string];
  /** Deeply rounded iOS squircle radius for glass surfaces. */
  radius: number;
}

export interface Tokens {
  mode: "light" | "dark";
  palette: Palette;
  neutral: Neutral;
  gradient: [string, string];
  /** Liquid Glass material tokens (see `glass.enabled`). */
  glass: GlassTokens;
  /** Elevated card / surface presets. */
  radii: { sm: number; md: number; lg: number; xl: number; pill: number };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  /** Soft elevation shadow (iOS + Android). */
  shadow: ViewStyle;
  /** Stronger shadow for hero / floating surfaces. */
  shadowStrong: ViewStyle;
  /** rgba() helper for the current palette primary. */
  primaryAlpha: (a: number) => string;
  /** Resolve a colorful tile pairing for a feature icon key. */
  feature: (iconKey: string) => FeatureColor;
  /** Generic rgba from a hex. */
  alpha: (hex: string, a: number) => string;
}

function makeShadow(mode: "light" | "dark", strong: boolean): ViewStyle {
  const opacity = mode === "dark" ? (strong ? 0.5 : 0.35) : strong ? 0.16 : 0.08;
  return {
    shadowColor: "#0b1020",
    shadowOffset: { width: 0, height: strong ? 10 : 6 },
    shadowOpacity: opacity,
    shadowRadius: strong ? 22 : 14,
    elevation: strong ? 8 : 3,
  };
}

export function useTokens(): Tokens {
  const { palette: paletteId, resolvedMode, surface } = useAppTheme();

  return useMemo(() => {
    const palette = getPalette(paletteId);
    const neutral = NEUTRALS[resolvedMode];
    const primaryRgb = rgbTriplet(palette.primary);
    const glassOn = surface === "glass";
    const glass: GlassTokens = {
      enabled: glassOn,
      tint: resolvedMode,
      intensity: resolvedMode === "dark" ? 60 : 80,
      overlay:
        resolvedMode === "dark"
          ? "rgba(40, 46, 60, 0.24)"
          : "rgba(255, 255, 255, 0.16)",
      border:
        resolvedMode === "dark"
          ? "rgba(255, 255, 255, 0.20)"
          : "rgba(255, 255, 255, 0.7)",
      sheen:
        resolvedMode === "dark"
          ? ["rgba(255, 255, 255, 0.22)", "rgba(255, 255, 255, 0)"]
          : ["rgba(255, 255, 255, 0.65)", "rgba(255, 255, 255, 0)"],
      radius: 28,
    };

    const alpha = (hex: string, a: number) => `rgba(${rgbTriplet(hex)}, ${a})`;

    const feature = (iconKey: string): FeatureColor => {
      const fg = FEATURE_HUES[iconKey] ?? palette.primary ?? DEFAULT_HUE;
      return {
        fg,
        tint: alpha(fg, resolvedMode === "dark" ? 0.22 : 0.13),
      };
    };

    return {
      mode: resolvedMode,
      palette,
      neutral,
      gradient: palette.gradient,
      glass,
      radii: { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },
      spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
      shadow: makeShadow(resolvedMode, false),
      shadowStrong: makeShadow(resolvedMode, true),
      primaryAlpha: (a: number) => `rgba(${primaryRgb}, ${a})`,
      feature,
      alpha,
    };
  }, [paletteId, resolvedMode, surface]);
}

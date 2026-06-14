/**
 * Theme catalog — single source of truth for color modes and palettes.
 *
 * A "mode" controls the neutral surfaces (light / dark), while a "palette"
 * controls the brand/accent colors. The two are orthogonal, like Slack.
 * The active theme is materialized into CSS custom properties (see
 * `utils/themeController`) so the entire SCSS-styled UI re-themes at runtime.
 */

export const THEME_STORAGE_KEY = "fl-theme";
export const SETTING_MODE_KEY = "theme_mode";
export const SETTING_PALETTE_KEY = "theme_palette";

export const MODES = ["light", "dark", "system"];
export const DEFAULT_MODE = "system";
export const DEFAULT_PALETTE = "indigo";

/* ---------------------------------------------------------------- color utils */

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function normalizeAngle(deg) {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function rgbTriplet(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}

function mix(hex, target, amount) {
  const a = hexToRgb(hex);
  const r = clamp(a.r + (target - a.r) * amount);
  const g = clamp(a.g + (target - a.g) * amount);
  const b = clamp(a.b + (target - a.b) * amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export const darken = (hex, amount) => mix(hex, 0, amount);
export const lighten = (hex, amount) => mix(hex, 255, amount);

export function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h *= 60;
  }
  return { h, s, l };
}

export function hslToHex(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp01(s);
  const lig = clamp01(l);
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return `#${[r, g, b]
    .map((v) => clamp((v + m) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Perceived luminance to pick readable text on the brand color. */
function readableOn(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1a1d29" : "#ffffff";
}

/* ----------------------------------------------------------------- neutrals */

export const NEUTRALS = {
  light: {
    bg: "#f6f7fb",
    surface: "#ffffff",
    surface2: "#f1f3f9",
    text: "#282e3e",
    textMinor: "#646f90",
    textMuted: "#939bb4",
    border: "#edeff4",
    borderStrong: "#e4e7f2",
  },
  dark: {
    bg: "#0f1117",
    surface: "#181b22",
    surface2: "#222632",
    text: "#e8eaf2",
    textMinor: "#a7afc4",
    textMuted: "#7b8499",
    border: "#2a2f3b",
    borderStrong: "#353c4a",
  },
};

/* ----------------------------------------------------------------- palettes */

/**
 * Each palette only needs a primary color (and optionally a gradient pair and
 * category). Darker/lighter/soft variants are derived so the catalog stays
 * compact and consistent.
 */
const RAW_PALETTES = [
  // Minimal — calm, single-accent.
  { id: "indigo", name: "Indigo", category: "Minimal", primary: "#4255ff" },
  { id: "slate", name: "Slate", category: "Minimal", primary: "#5b6478" },
  { id: "graphite", name: "Graphite", category: "Minimal", primary: "#3f3f46" },
  { id: "forest", name: "Forest", category: "Minimal", primary: "#3f6f52" },

  // Colorful — vivid single accents.
  { id: "emerald", name: "Emerald", category: "Colorful", primary: "#10b981" },
  { id: "tangerine", name: "Tangerine", category: "Colorful", primary: "#f97316" },
  { id: "rose", name: "Rose", category: "Colorful", primary: "#f43f5e" },
  { id: "violet", name: "Violet", category: "Colorful", primary: "#8b5cf6" },
  { id: "cyan", name: "Cyan", category: "Colorful", primary: "#06b6d4" },
  { id: "banana", name: "Banana", category: "Colorful", primary: "#eab308" },

  // Gradient — dual-tone accents used for hero surfaces and primary buttons.
  {
    id: "sunset",
    name: "Sunset",
    category: "Gradient",
    primary: "#fb5d8f",
    gradient: ["#fb5d8f", "#ff8a5b"],
  },
  {
    id: "ocean",
    name: "Ocean",
    category: "Gradient",
    primary: "#2563eb",
    gradient: ["#2563eb", "#06b6d4"],
  },
  {
    id: "aurora",
    name: "Aurora",
    category: "Gradient",
    primary: "#7c3aed",
    gradient: ["#7c3aed", "#ec4899"],
  },
  {
    id: "lagoon",
    name: "Lagoon",
    category: "Gradient",
    primary: "#0ea5e9",
    gradient: ["#22c55e", "#0ea5e9"],
  },

  // Deep — rich, moody accents (great paired with dark mode).
  { id: "aubergine", name: "Aubergine", category: "Deep", primary: "#7b2d6b" },
  { id: "jazz", name: "Jazz Club", category: "Deep", primary: "#b1361f" },
  { id: "midnight", name: "Midnight", category: "Deep", primary: "#3949ab" },
  { id: "wine", name: "Wine", category: "Deep", primary: "#9b1c4b" },
];

/** Reference hue of the brand logo gradient (purple → teal); used to rotate it. */
const LOGO_BASE_HUE = 234;

/** Produce an analogous color: same family as the base, shifted hue, tuned S/L. */
function harmonize(hsl, hueShift, satFactor, lMin, lMax) {
  const s = clamp01(Math.max(0.32, Math.min(hsl.s * satFactor, 0.82)));
  const l = clamp01(Math.max(lMin, Math.min(hsl.l, lMax)));
  return hslToHex(hsl.h + hueShift, s, l);
}

function buildPalette(raw) {
  const { primary } = raw;
  const gradient = raw.gradient || [primary, lighten(primary, 0.22)];
  const hsl = rgbToHsl(hexToRgb(primary));

  // Harmonious, analogous accent group (Slack-style): the accents stay in the
  // same color family as the primary so the UI feels cohesive — distinct enough
  // for variety, never a clashing complement.
  //  - accent  : leans ~ -42° (secondary action color, the $blue slot)
  //  - accent2 : leans ~ +34° (highlight color, the $yellow slot)
  // Gradient palettes reuse their hand-picked partner color as the accent.
  let accent = raw.accent;
  if (!accent && raw.gradient) {
    accent =
      raw.gradient[0].toLowerCase() === primary.toLowerCase()
        ? raw.gradient[1]
        : raw.gradient[0];
  }
  if (!accent) accent = harmonize(hsl, -42, 0.92, 0.42, 0.55);
  const accent2 = raw.accent2 || harmonize(hsl, 34, 0.8, 0.46, 0.6);

  return {
    ...raw,
    gradient,
    primaryDark: darken(primary, 0.14),
    primaryHover: lighten(primary, 0.32),
    primarySoft: lighten(primary, 0.14),
    onPrimary: readableOn(primary),
    accent,
    accentStrong: darken(accent, 0.12),
    accent2,
    accent2Strong: darken(accent2, 0.12),
    logoRotate: normalizeAngle(hsl.h - LOGO_BASE_HUE),
  };
}

export const PALETTES = RAW_PALETTES.map(buildPalette);

export const PALETTE_MAP = PALETTES.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, {});

export const PALETTE_CATEGORIES = PALETTES.reduce((acc, p) => {
  (acc[p.category] = acc[p.category] || []).push(p);
  return acc;
}, {});

export const CATEGORY_ORDER = ["Minimal", "Colorful", "Gradient", "Deep"];

export function getPalette(id) {
  return PALETTE_MAP[id] || PALETTE_MAP[DEFAULT_PALETTE];
}

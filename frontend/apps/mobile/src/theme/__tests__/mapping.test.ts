import { getPalette, NEUTRALS } from "@flashlearn/core";
import { buildPaperTheme, buildNavigationTheme } from "@/theme/mapping";

describe("buildPaperTheme", () => {
  it("maps the palette primary and neutral surfaces for light mode", () => {
    const palette = getPalette("indigo");
    const theme = buildPaperTheme("indigo", "light");
    expect(theme.colors.primary).toBe(palette.primary);
    expect(theme.colors.onPrimary).toBe(palette.onPrimary);
    expect(theme.colors.background).toBe(NEUTRALS.light.bg);
    expect(theme.colors.surface).toBe(NEUTRALS.light.surface);
    expect(theme.dark).toBe(false);
  });

  it("uses dark neutrals for dark mode", () => {
    const theme = buildPaperTheme("emerald", "dark");
    expect(theme.colors.background).toBe(NEUTRALS.dark.bg);
    expect(theme.colors.onSurface).toBe(NEUTRALS.dark.text);
    expect(theme.dark).toBe(true);
  });

  it("falls back to the default palette for an unknown id", () => {
    const fallback = getPalette("does-not-exist");
    const theme = buildPaperTheme("does-not-exist", "light");
    expect(theme.colors.primary).toBe(fallback.primary);
  });
});

describe("buildNavigationTheme", () => {
  it("maps palette + neutrals onto a navigation theme", () => {
    const palette = getPalette("ocean");
    const nav = buildNavigationTheme("ocean", "dark");
    expect(nav.dark).toBe(true);
    expect(nav.colors.primary).toBe(palette.primary);
    expect(nav.colors.background).toBe(NEUTRALS.dark.bg);
    expect(nav.colors.card).toBe(NEUTRALS.dark.surface);
  });
});

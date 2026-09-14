import { Platform } from "react-native";
import { useAppTheme } from "@/theme/ThemeProvider";
import { useTokens } from "@/theme/tokens";

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useMemo: (factory: () => unknown) => factory(),
}));

jest.mock("@/theme/ThemeProvider", () => ({
  useAppTheme: jest.fn(),
}));

afterEach(() => {
  jest.restoreAllMocks();
});

describe.each(["light", "dark"] as const)("%s surface shadows", (mode) => {
  it.each(["solid", "glass"] as const)("avoids Android elevation in %s mode", (surface) => {
    jest.replaceProperty(Platform, "OS", "android");
    jest.mocked(useAppTheme).mockReturnValue({
      palette: "indigo",
      resolvedMode: mode,
      surface,
    } as ReturnType<typeof useAppTheme>);

    const tokens = useTokens();

    expect(tokens.glass.enabled).toBe(surface === "glass");
    for (const shadow of [tokens.shadow, tokens.shadowStrong]) {
      expect(shadow.elevation).toBeUndefined();
      expect(shadow.shadowColor).toBeUndefined();
      expect(shadow.boxShadow).toEqual([
        expect.objectContaining({
          offsetX: 0,
          offsetY: expect.any(Number),
          blurRadius: expect.any(Number),
          color: expect.stringMatching(/^rgba\(11, 16, 32, /),
        }),
      ]);
    }
  });

  it("preserves iOS native shadows", () => {
    jest.replaceProperty(Platform, "OS", "ios");
    jest.mocked(useAppTheme).mockReturnValue({
      palette: "indigo",
      resolvedMode: mode,
      surface: "glass",
    } as ReturnType<typeof useAppTheme>);

    const tokens = useTokens();

    for (const shadow of [tokens.shadow, tokens.shadowStrong]) {
      expect(shadow.boxShadow).toBeUndefined();
      expect(shadow.shadowColor).toBe("#0b1020");
      expect(shadow.shadowOpacity).toBeGreaterThan(0);
    }
  });
});
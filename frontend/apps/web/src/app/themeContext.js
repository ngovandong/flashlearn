import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { useSelector } from "react-redux";
import { selectToken } from "@app/store/authSlice";
import { userSettingService } from "@api-services/userSettingService";
import {
  DEFAULT_MODE,
  DEFAULT_PALETTE,
  SETTING_MODE_KEY,
  SETTING_PALETTE_KEY,
} from "@constants/themes";
import {
  applyTheme,
  buildMuiTheme,
  readStoredTheme,
  resolveMode,
  watchSystem,
  writeStoredTheme,
} from "@utils/themeController";

const AppThemeContext = createContext({
  mode: DEFAULT_MODE,
  palette: DEFAULT_PALETTE,
  resolvedMode: "light",
  setMode: () => {},
  setPalette: () => {},
});

export const useAppTheme = () => useContext(AppThemeContext);

export function AppThemeProvider({ children }) {
  const stored = readStoredTheme();
  const [mode, setModeState] = useState(stored.mode);
  const [palette, setPaletteState] = useState(stored.palette);
  const token = useSelector(selectToken);
  const didLoadFromServer = useRef(false);

  // Materialize the theme into CSS variables whenever the selection changes.
  useEffect(() => {
    applyTheme(mode, palette);
    writeStoredTheme(mode, palette);
  }, [mode, palette]);

  // Re-apply when the OS theme flips while in "system" mode.
  useEffect(() => {
    if (mode !== "system") return undefined;
    return watchSystem(() => applyTheme("system", palette));
  }, [mode, palette]);

  // Reconcile with the server copy once after authentication.
  useEffect(() => {
    if (!token) {
      didLoadFromServer.current = false;
      return undefined;
    }
    if (didLoadFromServer.current) return undefined;
    didLoadFromServer.current = true;
    let active = true;
    (async () => {
      const res = await userSettingService.getSettings();
      if (!active || res.error || !res.data) return;
      const serverMode = res.data[SETTING_MODE_KEY];
      const serverPalette = res.data[SETTING_PALETTE_KEY];
      if (serverMode) setModeState(serverMode);
      if (serverPalette) setPaletteState(serverPalette);
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const persist = useCallback(
    (next) => {
      if (!token) return;
      userSettingService.updateSettings(next).catch(() => {});
    },
    [token]
  );

  const setMode = useCallback(
    (next) => {
      setModeState(next);
      persist({ [SETTING_MODE_KEY]: next });
    },
    [persist]
  );

  const setPalette = useCallback(
    (next) => {
      setPaletteState(next);
      persist({ [SETTING_PALETTE_KEY]: next });
    },
    [persist]
  );

  const muiTheme = useMemo(() => buildMuiTheme(mode, palette), [mode, palette]);

  const value = useMemo(
    () => ({
      mode,
      palette,
      resolvedMode: resolveMode(mode),
      setMode,
      setPalette,
    }),
    [mode, palette, setMode, setPalette]
  );

  return (
    <AppThemeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
    </AppThemeContext.Provider>
  );
}

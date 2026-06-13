import { createTheme } from "@mui/material";

/** Single source of truth for app color tokens. */
export const themeTokens = {
  primary: "#4255ff",
  purple: "#4255ff",
  darkPurple: "#423ed8",
  yellow: "#ffcd1f",
  errorRed: "#ff7873",
  blue: "#3ccfcf",
  lightBlue: "#59e8b5",
  appBackground: "#f6f7fb",
  mainText: "#282e3e",
  minorText: "#646f90",
  grayText: "#939bb4",
  white: "#ffffff",
};

const theme = createTheme({
  palette: {
    primary: {
      main: themeTokens.primary,
    },
    purple: {
      main: themeTokens.purple,
    },
    white: {
      main: themeTokens.white,
      dark: themeTokens.purple,
    },
    yellow: {
      main: themeTokens.yellow,
    },
    grey: {
      main: "#ccc",
    },
    blue: {
      main: themeTokens.blue,
      light: themeTokens.white,
      contrastText: themeTokens.white,
    },
  },
});

export default theme;

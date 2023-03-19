import { createTheme } from "@mui/material";

const theme = createTheme({
  palette: {
    primary: {
      main: "#4255ff",
    },
    purple: {
      main: "#4255ff",
    },
    white: {
      main: "#ffffff",
      dark: "#4255ff",
    },
    yellow: {
      main: "#ffcd1f",
    },
    blue: {
      main: "#3ccfcf",
      // dark: "#fff",
      light: "#fff",
      contrastText: "#fff",
    },
  },
});

export default theme;

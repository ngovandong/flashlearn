import React from "react";
import ReactDOM from "react-dom/client";
import reportWebVitals from "./reportWebVitals";
import { Provider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";
import store from "./app/store";
import queryClient from "./app/queryClient";
import App from "./app/App";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./styles/sass/index.scss";
import { AppThemeProvider } from "./app/themeContext";
import { applyTheme, readStoredTheme } from "./utils/themeController";

const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

// One-time auth migration. Older builds persisted the {access, refresh} token in
// localStorage. The app now keeps the refresh token in an HttpOnly cookie and
// the access token only in memory, so any leftover localStorage token is stale
// and unusable. Purge it (and force a clean re-login via the new cookie flow)
// so an old logged-in user isn't left in a half-authenticated state.
try {
  if (localStorage.getItem("token") !== null) {
    localStorage.removeItem("token");
  }
} catch {
  // localStorage unavailable (private mode / disabled) — nothing to clean.
}

// Apply the cached theme before first paint to avoid a flash of default colors.
const storedTheme = readStoredTheme();
applyTheme(storedTheme.mode, storedTheme.palette);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <Provider store={store}>
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <GoogleOAuthProvider clientId={clientId}>
          <App />
        </GoogleOAuthProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  </Provider>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

import { createHttpClient } from "@flashlearn/api";
import { ENV } from "@/config/env";
import { store } from "@/store";
import { setToken, logout } from "@/store/authSlice";
import { performRefresh } from "@/auth/refresh";

// Native HTTP client: Bearer access token from Redux memory, body-based refresh
// backed by SecureStore, and a hard logout when the refresh itself fails.
export const request = createHttpClient({
  baseURL: ENV.apiBaseUrl,
  withCredentials: false,
  getAccessToken: () => store.getState().auth.token?.access ?? null,
  refresh: (bare) => performRefresh(bare),
  onTokensRefreshed: ({ access }) => store.dispatch(setToken({ access })),
  onAuthFailure: () => store.dispatch(logout()),
});

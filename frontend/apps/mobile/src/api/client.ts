import { createHttpClient } from "@flashlearn/api";
import { ENV } from "@/config/env";
import { authBridge } from "@/api/authBridge";
import { performRefresh } from "@/auth/refresh";

// Native HTTP client: Bearer access token from Redux memory, body-based refresh
// backed by SecureStore, and a hard logout when the refresh itself fails. The
// store is reached through `authBridge` (not a direct import) to avoid a require
// cycle back into the auth slice.
export const request = createHttpClient({
  baseURL: ENV.apiBaseUrl,
  withCredentials: false,
  getAccessToken: () => authBridge.getAccessToken(),
  refresh: (bare) => performRefresh(bare),
  onTokensRefreshed: (tokens) => authBridge.onTokensRefreshed(tokens),
  onAuthFailure: () => authBridge.onAuthFailure(),
});

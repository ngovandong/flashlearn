import * as Google from "expo-auth-session/providers/google";
import type { AuthSessionResult } from "expo-auth-session";
import { ENV } from "@/config/env";

/**
 * Native Google Sign-In via the system browser (expo-auth-session). We request
 * an ID token and hand it to the backend's `users/init/` endpoint — the same
 * exchange the web app performs, so no Google OAuth ever runs inside a WebView.
 */
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: ENV.google.webClientId,
    iosClientId: ENV.google.iosClientId || undefined,
    androidClientId: ENV.google.androidClientId || undefined,
    scopes: ["openid", "profile", "email"],
  });

  return { request, response, promptAsync };
}

/** Pull the ID token out of a successful auth-session response. */
export function extractIdToken(
  response: AuthSessionResult | null
): string | null {
  if (!response || response.type !== "success") return null;
  return (
    (response.params && response.params.id_token) ||
    response.authentication?.idToken ||
    null
  );
}

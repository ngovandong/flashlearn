import { useCallback } from "react";
import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import type { AuthSessionResult } from "expo-auth-session";
import { ENV } from "@/config/env";

type GoogleSigninModule = typeof import("@react-native-google-signin/google-signin");

// The Google Sign-In native module is compiled into a dev/production build but
// is absent from Expo Go — importing it there throws at load time. In Expo Go we
// therefore fall back to the browser-based expo-auth-session flow.
const isExpoGo = Constants.appOwnership === "expo";

/** Whether Google sign-in can run at all (needs the web client id). */
export const isGoogleAuthConfigured = Boolean(ENV.google.webClientId);

export type GoogleSignInResult =
  | { status: "success"; idToken: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

let configured = false;

// Lazy require so merely importing this file never loads the native module
// (which would crash Expo Go). Only called on builds where the module exists.
function loadNativeModule(): GoogleSigninModule {
  return require("@react-native-google-signin/google-signin");
}

function ensureNativeConfigured(mod: GoogleSigninModule): void {
  if (configured) return;
  mod.GoogleSignin.configure({
    webClientId: ENV.google.webClientId,
    iosClientId: ENV.google.iosClientId || undefined,
  });
  configured = true;
}

/**
 * Native Google account-chooser popup via Google Play services — the native
 * counterpart to the web app's account-picker popup. We sign out first so the
 * chooser always appears (mirroring the web's `prompt: select_account`).
 */
async function signInWithNativePopup(): Promise<GoogleSignInResult> {
  const mod = loadNativeModule();
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = mod;
  ensureNativeConfigured(mod);

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    await GoogleSignin.signOut();

    const response = await GoogleSignin.signIn();
    if (isSuccessResponse(response)) {
      const idToken = response.data.idToken;
      if (!idToken) return { status: "error", message: "Google login failed." };
      return { status: "success", idToken };
    }
    return { status: "cancelled" };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.IN_PROGRESS) {
      return { status: "cancelled" };
    }
    return { status: "error", message: "Google login failed." };
  }
}

/** Map an expo-auth-session result (Expo Go browser flow) into our shape. */
function resultFromAuthSession(
  result: AuthSessionResult | null
): GoogleSignInResult {
  if (!result) return { status: "error", message: "Google login failed." };
  if (result.type === "cancel" || result.type === "dismiss") {
    return { status: "cancelled" };
  }
  if (result.type !== "success") {
    return { status: "error", message: "Google login failed." };
  }
  const idToken =
    (result.params && result.params.id_token) ||
    result.authentication?.idToken ||
    null;
  if (!idToken) return { status: "error", message: "Google login failed." };
  return { status: "success", idToken };
}

/**
 * Unified Google sign-in. Returns `signIn`, which triggers the native popup on
 * dev/production builds and the browser-based flow inside Expo Go, plus `ready`
 * (whether the button can be tapped yet).
 */
export function useGoogleSignIn(): {
  signIn: () => Promise<GoogleSignInResult>;
  ready: boolean;
} {
  // Guarded by a module-level constant, so hook order is stable across renders.
  if (!isGoogleAuthConfigured) {
    return {
      signIn: async () => ({
        status: "error",
        message: "Google sign-in is not configured.",
      }),
      ready: false,
    };
  }

  // Only actually used in Expo Go, but calling the hook unconditionally keeps
  // hook order consistent regardless of the runtime environment.
  const [request, , promptAsync] = Google.useAuthRequest({
    webClientId: ENV.google.webClientId,
    iosClientId: ENV.google.iosClientId || undefined,
    androidClientId: ENV.google.androidClientId || undefined,
    scopes: ["openid", "profile", "email"],
  });

  const signIn = useCallback(async (): Promise<GoogleSignInResult> => {
    if (isExpoGo) {
      return resultFromAuthSession(await promptAsync());
    }
    return signInWithNativePopup();
  }, [promptAsync]);

  return { signIn, ready: isExpoGo ? Boolean(request) : true };
}

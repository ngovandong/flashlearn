import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// The refresh token is the only long-lived credential kept on device; store it
// in the OS keychain/keystore via expo-secure-store. The access token stays in
// memory (Redux) only.
const REFRESH_KEY = "fl_refresh_token";

// expo-secure-store is native-only. On web there is no keychain, so fall back to
// localStorage (the pragmatic option for the web build; access token still lives
// only in memory).
const isWeb = Platform.OS === "web";
const hasLocalStorage = () =>
  typeof globalThis !== "undefined" &&
  typeof (globalThis as any).localStorage !== "undefined";

export const secureStorage = {
  async getRefreshToken(): Promise<string | null> {
    if (isWeb) {
      return hasLocalStorage() ? localStorage.getItem(REFRESH_KEY) : null;
    }
    return SecureStore.getItemAsync(REFRESH_KEY);
  },
  async setRefreshToken(token: string | null | undefined): Promise<void> {
    if (!token) {
      await this.clear();
      return;
    }
    if (isWeb) {
      if (hasLocalStorage()) localStorage.setItem(REFRESH_KEY, token);
      return;
    }
    await SecureStore.setItemAsync(REFRESH_KEY, token);
  },
  async clear(): Promise<void> {
    if (isWeb) {
      if (hasLocalStorage()) localStorage.removeItem(REFRESH_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};

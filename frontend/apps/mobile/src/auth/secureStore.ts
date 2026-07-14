import * as SecureStore from "expo-secure-store";

// The refresh token is the only long-lived credential kept on device; store it
// in the OS keychain/keystore via expo-secure-store. The access token stays in
// memory (Redux) only.
const REFRESH_KEY = "fl_refresh_token";

export const secureStorage = {
  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },
  async setRefreshToken(token: string | null | undefined): Promise<void> {
    if (token) {
      await SecureStore.setItemAsync(REFRESH_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    }
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};

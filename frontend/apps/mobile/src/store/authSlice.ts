import { createAuthSlice } from "@flashlearn/auth";
import { nativeAuthApi } from "@/auth/nativeAuthApi";
import { secureStorage } from "@/auth/secureStore";

// Native session: access token in Redux memory, refresh token in SecureStore.
// Clearing the local credential on logout is best-effort and never blocks the
// reducer (mirrors the web slice, which calls googleLogout there).
const authSlice = createAuthSlice({
  authApi: nativeAuthApi,
  onLogout: () => {
    secureStorage.clear().catch(() => {});
  },
});

export const { login, getUser, bootstrapSession, logoutUser } = authSlice.thunks;

export const {
  logout,
  setToken,
  markBootstrapped,
  setError,
  setLoading,
  setGlobalError,
} = authSlice.actions;

export const {
  selectUser,
  selectToken,
  selectError,
  selectLoading,
  selectBootstrapped,
  selectGlobalError,
} = authSlice.selectors;

export const authReducer = authSlice.reducer;
export default authSlice.reducer;

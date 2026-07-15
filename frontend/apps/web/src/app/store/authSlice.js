import { googleLogout } from "@react-oauth/google";
import { createAuthSlice } from "@flashlearn/auth";
import authService from "@api-services/authService";
import { sendTokenToExtension } from "@utils/extensionLogin";

// Auth model: the refresh token lives in an HttpOnly cookie (set by the backend,
// unreadable by JS). The frontend only ever holds the short-lived ACCESS token
// in memory (Redux) — never in localStorage. On reload the in-memory access
// token is gone, so bootstrapSession silently calls /users/refresh (which sends
// the cookie) to mint a new one; see App.
const authSlice = createAuthSlice({
  authApi: authService,
  onLoginSuccess: (data) => sendTokenToExtension(data),
  onLogout: () => googleLogout(),
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

export default authSlice.reducer;

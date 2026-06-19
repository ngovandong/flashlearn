import { googleLogout } from "@react-oauth/google";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import authService from "@api-services/authService";
import { getFirstError } from "@utils/errorHandler";
import { sendTokenToExtension } from "@utils/extensionLogin";

// Auth model: the refresh token lives in an HttpOnly cookie (set by the backend,
// unreadable by JS). The frontend only ever holds the short-lived ACCESS token,
// in memory (Redux) — never in localStorage. On a page reload the in-memory
// access token is gone, so we silently call /users/refresh (which sends the
// cookie) to mint a new one; see bootstrapSession + App.

export const login = createAsyncThunk("auth/login", async (user) => {
  const { email, password } = user;
  const res = await authService.login(email, password);
  if (!res.error) {
    sendTokenToExtension(res.data);
    return res.data; // { access, user }
  } else {
    const errorMessage = getFirstError(res.error);
    throw new Error(errorMessage);
  }
});

export const getUser = createAsyncThunk("auth/getUser", async () => {
  const res = await authService.getUser();
  return res;
});

// Re-establish the session on app load using the HttpOnly refresh cookie. If the
// cookie is missing/expired the call fails and we stay logged out.
export const bootstrapSession = createAsyncThunk(
  "auth/bootstrap",
  async (_, { dispatch }) => {
    try {
      const data = await authService.refresh();
      if (data?.access) {
        dispatch(setToken({ access: data.access }));
      }
    } catch {
      // not logged in — leave the session empty
    }
  }
);

// User-initiated logout: revoke the refresh cookie server-side (blacklist +
// clear cookie), then clear local state. Best-effort — local logout happens
// regardless of whether the network call succeeds.
export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { dispatch }) => {
    try {
      await authService.logout();
    } catch {
      // ignore — we still clear the session locally below
    }
    dispatch(logout());
  }
);

const initialState = {
  user: null,
  token: null,
  error: "",
  loading: false,
  // false until the initial silent refresh attempt completes — the app shows a
  // loader until then so it doesn't flash the login page before we know.
  bootstrapped: false,
  globalError: null,
};

const userSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setError: (state, action) => {
      state.error = action.payload;
    },
    setGlobalError: (state, action) => {
      state.globalError = action.payload;
    },
    setToken: (state, action) => {
      const payload = action.payload || {};
      state.token = payload.access ? { access: payload.access } : null;
      if ("user" in payload) {
        state.user = payload.user;
      }
    },
    // Mark the initial session check as done without hitting /refresh — used on
    // public auth pages (login/signup) where we deliberately skip the cookie probe.
    markBootstrapped: (state) => {
      state.bootstrapped = true;
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      googleLogout();
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(login.pending, (state, _) => {
        state.loading = true;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.token = { access: action.payload.access };
        state.user = action.payload.user;
        state.loading = false;
      })
      .addCase(login.rejected, (state, action) => {
        state.error = action.error.message;
        state.loading = false;
      })
      .addCase(bootstrapSession.fulfilled, (state, _) => {
        state.bootstrapped = true;
      })
      .addCase(bootstrapSession.rejected, (state, _) => {
        state.bootstrapped = true;
      })
      .addCase(getUser.pending, (state, _) => {
        state.loading = true;
      })
      .addCase(getUser.rejected, (state, _) => {
        state.error = "Couldn't load your account. Please try again.";
        state.loading = false;
      })
      .addCase(getUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.loading = false;
      });
  },
});

export const selectUser = (state) => state.auth.user;
export const selectToken = (state) => state.auth.token;
export const selectError = (state) => state.auth.error;
export const selectLoading = (state) => state.auth.loading;
export const selectBootstrapped = (state) => state.auth.bootstrapped;
export const selectGlobalError = (state) => state.auth.globalError;

export const {
  logout,
  setToken,
  markBootstrapped,
  setError,
  setLoading,
  setGlobalError,
} = userSlice.actions;
export default userSlice.reducer;

import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { getFirstError, type AuthUser, type LoginPayload } from "@flashlearn/core";

export interface AuthToken {
  access: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: AuthToken | null;
  error: string;
  loading: boolean;
  // false until the initial silent refresh attempt completes — the app shows a
  // loader until then so it doesn't flash the login page before we know.
  bootstrapped: boolean;
  globalError: string | null;
}

export interface RootStateWithAuth {
  auth: AuthState;
}

/** The auth network surface the slice depends on (platform-injected). */
export interface AuthSliceApi {
  login(
    email: string,
    password: string
  ): Promise<{ error?: unknown; data?: LoginPayload }>;
  getUser(): Promise<AuthUser>;
  refresh(): Promise<{ access: string; refresh?: string }>;
  logout(): Promise<unknown>;
}

export interface AuthSliceDeps {
  authApi: AuthSliceApi;
  /** Runs on a successful password login (web: hand the token to the extension). */
  onLoginSuccess?: (data: LoginPayload) => void;
  /** Runs when the local session is cleared (web: googleLogout; native: wipe store). */
  onLogout?: () => void;
}

const initialState: AuthState = {
  user: null,
  token: null,
  error: "",
  loading: false,
  bootstrapped: false,
  globalError: null,
};

/**
 * Build the shared auth slice. All platform-specific behavior (extension
 * handoff, Google sign-out, secure-store wipes) is injected via `deps` so web
 * and native share the same state machine and thunks.
 */
export function createAuthSlice(deps: AuthSliceDeps) {
  const { authApi, onLoginSuccess, onLogout } = deps;

  const login = createAsyncThunk(
    "auth/login",
    async (user: { email: string; password: string }) => {
      const { email, password } = user;
      const res = await authApi.login(email, password);
      if (!res.error) {
        if (res.data) onLoginSuccess?.(res.data);
        return res.data as LoginPayload; // { access, user }
      }
      throw new Error(getFirstError(res.error));
    }
  );

  const getUser = createAsyncThunk("auth/getUser", async () => {
    return authApi.getUser();
  });

  // Re-establish the session on app load. On web this uses the HttpOnly refresh
  // cookie; on native the adapter reads the refresh token from secure storage.
  const bootstrapSession = createAsyncThunk(
    "auth/bootstrap",
    async (_: void, { dispatch }) => {
      try {
        const data = await authApi.refresh();
        if (data?.access) {
          dispatch(slice.actions.setToken({ access: data.access }));
        }
      } catch {
        // not logged in — leave the session empty
      }
    }
  );

  // User-initiated logout: best-effort server revoke, then always clear locally.
  const logoutUser = createAsyncThunk(
    "auth/logoutUser",
    async (_: void, { dispatch }) => {
      try {
        await authApi.logout();
      } catch {
        // ignore — we still clear the session locally below
      }
      dispatch(slice.actions.logout());
    }
  );

  const slice = createSlice({
    name: "auth",
    initialState,
    reducers: {
      setError: (state, action: PayloadAction<string>) => {
        state.error = action.payload;
      },
      setGlobalError: (state, action: PayloadAction<string | null>) => {
        state.globalError = action.payload;
      },
      setToken: (
        state,
        action: PayloadAction<{ access?: string; user?: AuthUser } | undefined>
      ) => {
        const payload = action.payload || {};
        state.token = payload.access ? { access: payload.access } : null;
        if ("user" in payload) {
          state.user = payload.user ?? null;
        }
      },
      markBootstrapped: (state) => {
        state.bootstrapped = true;
      },
      logout: (state) => {
        state.token = null;
        state.user = null;
        onLogout?.();
      },
      setLoading: (state, action: PayloadAction<boolean>) => {
        state.loading = action.payload;
      },
    },
    extraReducers(builder) {
      builder
        .addCase(login.pending, (state) => {
          state.loading = true;
        })
        .addCase(login.fulfilled, (state, action) => {
          state.token = { access: action.payload.access };
          state.user = action.payload.user ?? null;
          state.loading = false;
        })
        .addCase(login.rejected, (state, action) => {
          state.error = action.error.message ?? "";
          state.loading = false;
        })
        .addCase(bootstrapSession.fulfilled, (state) => {
          state.bootstrapped = true;
        })
        .addCase(bootstrapSession.rejected, (state) => {
          state.bootstrapped = true;
        })
        .addCase(getUser.pending, (state) => {
          state.loading = true;
        })
        .addCase(getUser.rejected, (state) => {
          state.error = "Couldn't load your account. Please try again.";
          state.loading = false;
        })
        .addCase(getUser.fulfilled, (state, action) => {
          state.user = action.payload;
          state.loading = false;
        });
    },
  });

  const selectors = {
    selectUser: (state: RootStateWithAuth) => state.auth.user,
    selectToken: (state: RootStateWithAuth) => state.auth.token,
    selectError: (state: RootStateWithAuth) => state.auth.error,
    selectLoading: (state: RootStateWithAuth) => state.auth.loading,
    selectBootstrapped: (state: RootStateWithAuth) => state.auth.bootstrapped,
    selectGlobalError: (state: RootStateWithAuth) => state.auth.globalError,
  };

  return {
    reducer: slice.reducer,
    actions: slice.actions,
    thunks: { login, getUser, bootstrapSession, logoutUser },
    selectors,
  };
}

export type AuthSlice = ReturnType<typeof createAuthSlice>;

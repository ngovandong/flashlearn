// Dependency-free indirection between the HTTP client and the Redux store.
//
// The client needs the current access token and must react to refresh / auth
// failure, but importing the store here would recreate the require cycle
// authSlice -> nativeAuthApi -> client -> store -> authSlice, which leaves the
// auth reducer uninitialized ("Cannot access 'authReducer' before
// initialization"). This module has no imports, so it breaks the cycle; the
// store installs the real handlers via `setAuthBridge` once it is created.

interface AuthBridge {
  getAccessToken: () => string | null;
  onTokensRefreshed: (tokens: { access: string }) => void;
  onAuthFailure: () => void;
}

let current: AuthBridge = {
  getAccessToken: () => null,
  onTokensRefreshed: () => {},
  onAuthFailure: () => {},
};

export function setAuthBridge(bridge: AuthBridge): void {
  current = bridge;
}

export const authBridge: AuthBridge = {
  getAccessToken: () => current.getAccessToken(),
  onTokensRefreshed: (tokens) => current.onTokensRefreshed(tokens),
  onAuthFailure: () => current.onAuthFailure(),
};

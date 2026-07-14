import axios from "axios";
import { jwtDecode } from "jwt-decode";
import store, { logout, setToken } from "../store";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

// Refresh a bit before the real expiry to absorb clock skew and avoid racing a
// request against the boundary.
const EXP_SKEW_SECONDS = 30;

function isAccessExpired(token) {
  if (!token?.access) return false;
  try {
    const { exp } = jwtDecode(token.access);
    if (!exp) return false;
    return Date.now() >= exp * 1000 - EXP_SKEW_SECONDS * 1000;
  } catch {
    // Undecodable access token — treat as expired so we try to refresh.
    return true;
  }
}

// Builds an axios client that keeps its access token fresh on its own:
//   - proactively refreshes an expired access token before a request is sent,
//     so an idle extension self-heals without waiting for a 401 round-trip;
//   - reactively refreshes once on a 401 (e.g. server-side revocation) and
//     retries the original request.
// `getToken` returns the current { access, refresh } pair; `onTokenRefresh` is
// called with the new pair on success, or null when the session can't be
// recovered.
function createAuthClient(getToken, onTokenRefresh) {
  // Dedupes concurrent refreshes so a burst of expired requests triggers a
  // single POST /users/refresh/.
  let refreshPromise = null;

  function refresh() {
    if (refreshPromise) return refreshPromise;
    const token = getToken();
    if (!token?.refresh) {
      return Promise.reject(new Error("No refresh token"));
    }
    // Uses the bare axios instance (no interceptors) so the refresh call can't
    // recurse through this handler.
    refreshPromise = axios
      .post("users/refresh/", { refresh: token.refresh })
      .then(({ data }) => {
        // Rotation echoes a new refresh token; merge so we never drop it.
        const next = { ...token, ...data };
        onTokenRefresh?.(next);
        return next;
      })
      .finally(() => {
        refreshPromise = null;
      });
    return refreshPromise;
  }

  const client = axios.create();

  client.interceptors.request.use(async (config) => {
    let token = getToken();
    if (token?.refresh && isAccessExpired(token)) {
      try {
        token = await refresh();
      } catch {
        // Refresh failed — fall through with the stale token and let the 401
        // response handler surface the expired session.
      }
    }
    if (token?.access) {
      config.headers.Authorization = `Bearer ${token.access}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      if (error.code === "ERR_NETWORK") {
        return { error: "Server Error" };
      }

      const token = getToken();
      const originalRequest = error.config;
      if (
        error.response?.status === 401 &&
        token?.refresh &&
        originalRequest &&
        !originalRequest._retried
      ) {
        originalRequest._retried = true;
        try {
          const next = await refresh();
          originalRequest.headers["Authorization"] = `Bearer ${next.access}`;
          return axios(originalRequest);
        } catch {
          onTokenRefresh?.(null);
          return { error: "Session expired. Please log in again." };
        }
      }

      if (error.response?.data) {
        return { error: error.response.data };
      }
      return error;
    }
  );

  return client;
}

const request = createAuthClient(
  () => store.getState().auth.token,
  (data) => {
    if (data) {
      store.dispatch(setToken(data));
    } else {
      store.dispatch(logout());
    }
  }
);

export function createRequest(token, { onTokenRefresh } = {}) {
  let currentToken = token;
  return createAuthClient(
    () => currentToken,
    (data) => {
      if (data) {
        currentToken = data;
        onTokenRefresh?.(data);
      } else {
        onTokenRefresh?.(null);
      }
    }
  );
}

export { request };

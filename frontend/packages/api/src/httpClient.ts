import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

export interface RefreshedTokens {
  access: string;
  refresh?: string;
}

export interface HttpClientConfig {
  /** API base URL (injected from the platform env). */
  baseURL: string;
  /** Web sends the HttpOnly refresh cookie; native does not. */
  withCredentials?: boolean;
  /** Read the current in-memory access token (or null when logged out). */
  getAccessToken: () => string | null | undefined;
  /**
   * Perform the refresh network call and return the new tokens (or throw).
   * Receives a bare axios instance (no interceptors) so it can't recurse.
   * The platform adapter is responsible for persisting a rotated refresh token.
   */
  refresh: (bare: AxiosInstance) => Promise<RefreshedTokens>;
  /** Persist / store the freshly minted access token (e.g. dispatch setToken). */
  onTokensRefreshed?: (tokens: RefreshedTokens) => void;
  /** Called when refreshing fails — clear the session (logout). */
  onAuthFailure?: () => void;
  /** Endpoints that must never trigger a refresh (would recurse). */
  authEndpointPattern?: RegExp;
  /**
   * Reports unexpected request failures site/app-wide (e.g. to Sentry): network
   * errors, 5xx responses, a failed token refresh, and anything with no
   * response at all. Deliberately NOT called for ordinary 4xx responses — those
   * are expected validation/auth failures the caller already surfaces to the
   * user, and reporting every one would drown real bugs in noise.
   */
  onError?: (error: unknown, context: { url?: string; status?: number }) => void;
}

interface QueuedRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  originalRequest: InternalAxiosRequestConfig;
}

const DEFAULT_AUTH_ENDPOINTS = /users\/(refresh|login|logout)\/?$/;

/**
 * Create an Axios instance that mirrors the original web `httpRequest`:
 *  - attaches a Bearer access token to every request,
 *  - on a 401 (for non-auth endpoints, when a token exists) refreshes once,
 *    queueing concurrent requests and replaying them with the new token,
 *  - clears the session when the refresh itself fails,
 *  - unwraps error bodies into `{ error }` for non-401 failures.
 *
 * All platform-specific behavior (token storage, cookie vs body refresh,
 * logout) is injected via `config`, so the same client works on web and native.
 */
export function createHttpClient(config: HttpClientConfig): AxiosInstance {
  const authEndpointPattern = config.authEndpointPattern ?? DEFAULT_AUTH_ENDPOINTS;

  // Bare instance: same base config but no interceptors, used for the refresh
  // call and for replaying the original request after a successful refresh.
  const bare = axios.create({
    baseURL: config.baseURL,
    withCredentials: config.withCredentials ?? false,
  });

  const request = axios.create({
    baseURL: config.baseURL,
    withCredentials: config.withCredentials ?? false,
  });

  let isRefreshing = false;
  let failedQueue: QueuedRequest[] = [];

  function processQueue(error: unknown, token: string | null = null) {
    failedQueue.forEach((promise) => {
      if (error) {
        promise.reject(error);
      } else {
        promise.originalRequest.headers["Authorization"] = `Bearer ${token}`;
        promise.resolve(bare(promise.originalRequest));
      }
    });
    failedQueue = [];
  }

  request.interceptors.request.use((req) => {
    const access = config.getAccessToken();
    if (access) {
      req.headers["Authorization"] = `Bearer ${access}`;
    }
    return req;
  });

  request.interceptors.response.use(
    (res: AxiosResponse) => res,
    async (error: AxiosError) => {
      const url = (error.config as InternalAxiosRequestConfig)?.url;

      if (error.code === "ERR_NETWORK") {
        config.onError?.(error, { url });
        return { error: "Network error. Please check your connection." };
      }
      const originalRequest = error.config as InternalAxiosRequestConfig;
      const isAuthEndpoint = authEndpointPattern.test(originalRequest?.url || "");
      const hasToken = !!config.getAccessToken();

      if (error.response?.status === 401 && hasToken && !isAuthEndpoint) {
        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const tokens = await config.refresh(bare);
            config.onTokensRefreshed?.(tokens);
            originalRequest.headers["Authorization"] = `Bearer ${tokens.access}`;
            processQueue(null, tokens.access);
            return bare(originalRequest);
          } catch (refreshError) {
            config.onError?.(refreshError, { url, status: 401 });
            config.onAuthFailure?.();
            processQueue("Logout Error", null);
          } finally {
            isRefreshing = false;
          }
        } else {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject, originalRequest });
          });
        }
      } else if (error.response?.data) {
        const status = error.response.status;
        if (status >= 500) {
          config.onError?.(error, { url, status });
        }
        return { error: error.response.data };
      } else {
        config.onError?.(error, { url, status: error.response?.status });
      }
      return error;
    }
  );

  return request;
}

import axios from "axios";
import { createHttpClient } from "@flashlearn/api";
import store from "@app/store";
import { setToken, logout } from "@app/store/authSlice";
import { Sentry } from "../config/sentry";

// Preserve the previous global axios defaults — crawlerService talks to an
// external URL through the raw axios instance and relied on these.
axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;
axios.defaults.withCredentials = true;

// Endpoints that hit an external AI provider can queue behind the backend's
// global rate-limit gate (~120s) on top of the provider call (~90s), so they
// need a much longer client timeout. Pass `{ timeout: AI_REQUEST_TIMEOUT }` on
// AI calls so they tolerate the wait but still fail cleanly.
export const AI_REQUEST_TIMEOUT = Number(
  import.meta.env.VITE_AI_REQUEST_TIMEOUT || 240000
);

// Web session model: the refresh token lives in an HttpOnly cookie (sent
// automatically with withCredentials), so refresh posts an empty body and the
// access token is kept only in memory (Redux).
export const request = createHttpClient({
  baseURL: import.meta.env.VITE_BASE_URL,
  withCredentials: true,
  getAccessToken: () => store.getState().auth.token?.access ?? null,
  refresh: async (bare) => {
    const { data } = await bare.post("users/refresh/");
    return { access: data.access };
  },
  onTokensRefreshed: ({ access }) => store.dispatch(setToken({ access })),
  onAuthFailure: () => store.dispatch(logout()),
  // Site-wide: any network error, 5xx, or failed token refresh from ANY API
  // call (not just auth) lands in Sentry, regardless of whether the caller
  // uses react-query, a Redux thunk, or a plain await.
  onError: (error, context) => Sentry.captureException(error, { tags: context }),
});

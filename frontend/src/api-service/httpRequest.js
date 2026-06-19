import axios from "axios";
import store from "@app/store";
import { setToken, logout } from "@app/store/authSlice";

const getCurrentToken = () => {
  return store.getState().auth.token;
};
const appendHeader = (request) => {
  const token = getCurrentToken();
  if (token) {
    const { access } = token;
    request.headers["Authorization"] = `Bearer ${access}`;
  }
  return request;
};

// const appendSlash = (request) => {
//   // if (!request.url.endsWith('/')) {
//   //     request.url += '/'
//   // }
//   return request;
// };

let isRefreshing = false;
let failedQueue = [];

const refreshToken = async (error) => {
  if (error.code === "ERR_NETWORK") {
    return { error: "Network error. Please check your connection." };
  }
  const originalRequest = error.config;
  // Never try to refresh the refresh/login calls themselves — that would recurse.
  const isAuthEndpoint = /users\/(refresh|login|logout)\/?$/.test(
    originalRequest?.url || ""
  );
  const token = getCurrentToken();
  if (error.response?.status === 401 && token && !isAuthEndpoint) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        // The refresh token rides in the HttpOnly cookie; no body needed.
        const { data } = await axios.post("users/refresh/");
        store.dispatch(setToken({ access: data.access }));
        originalRequest.headers["Authorization"] = `Bearer ${data.access}`;
        processQueue(null, data.access);
        return axios(originalRequest);
      } catch {
        store.dispatch(logout());
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
    return { error: error.response.data };
  }
  return error;
};

function processQueue(error, token = null) {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.originalRequest.headers["Authorization"] = `Bearer ${token}`;
      promise.resolve(axios(promise.originalRequest));
    }
  });
  failedQueue = [];
}

axios.defaults.baseURL = process.env.REACT_APP_BASE_URL;
// Send the HttpOnly refresh cookie on auth calls (login/refresh/logout) and any
// same-site API request. Required for the cookie-based refresh flow.
axios.defaults.withCredentials = true;

// Endpoints that hit an external AI provider can now queue behind the backend's
// global rate-limit gate (AI_GATE_MAX_WAIT, ~120s) on top of the provider call
// itself (GEMINI_TIMEOUT, ~90s), so they need a much longer client timeout than
// a normal request. Pass `{ timeout: AI_REQUEST_TIMEOUT }` on AI calls so they
// tolerate the wait but still fail cleanly instead of hanging forever.
export const AI_REQUEST_TIMEOUT = Number(
  process.env.REACT_APP_AI_REQUEST_TIMEOUT || 240000
);

const request = axios.create({ withCredentials: true });

request.interceptors.request.use(appendHeader);
// request.interceptors.request.use(appendSlash);

request.interceptors.response.use((res) => res, refreshToken);

export { request };

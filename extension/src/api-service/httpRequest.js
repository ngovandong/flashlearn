import axios from "axios";
import store, { logout, setToken } from "../store";

axios.defaults.baseURL = process.env.REACT_APP_BASE_URL;

function processQueue(failedQueue, error, token = null) {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.originalRequest.headers["Authorization"] = `Bearer ${token}`;
      promise.resolve(axios(promise.originalRequest));
    }
  });
  failedQueue.length = 0;
}

function createRefreshHandler(getToken, onTokenRefresh, failedQueueRef) {
  let isRefreshing = false;

  return async (error) => {
    if (error.code === "ERR_NETWORK") {
      return { error: "Server Error" };
    }

    const token = getToken();
    if (error.response?.status === 401 && token?.refresh) {
      const originalRequest = error.config;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const { data } = await axios.post("users/refresh/", {
            refresh: token.refresh,
          });
          onTokenRefresh?.(data);
          originalRequest.headers["Authorization"] = `Bearer ${data.access}`;
          processQueue(failedQueueRef, null, data.access);
          return axios(originalRequest);
        } catch {
          onTokenRefresh?.(null);
          processQueue(failedQueueRef, new Error("Logout Error"), null);
          return { error: "Session expired. Please log in again." };
        } finally {
          isRefreshing = false;
        }
      }

      return new Promise((resolve, reject) => {
        failedQueueRef.push({ resolve, reject, originalRequest });
      });
    }

    if (error.response?.data) {
      return { error: error.response.data };
    }
    return error;
  };
}

const popupFailedQueue = [];
const getPopupToken = () => store.getState().auth.token;

const request = axios.create();
request.interceptors.request.use((config) => {
  const token = getPopupToken();
  if (token?.access) {
    config.headers.Authorization = `Bearer ${token.access}`;
  }
  return config;
});
request.interceptors.response.use(
  (res) => res,
  createRefreshHandler(
    getPopupToken,
    (data) => {
      if (data) {
        store.dispatch(setToken(data));
      } else {
        store.dispatch(logout());
      }
    },
    popupFailedQueue
  )
);

export function createRequest(token, { onTokenRefresh } = {}) {
  let currentToken = token;
  const failedQueue = [];

  const client = axios.create();

  client.interceptors.request.use((config) => {
    if (currentToken?.access) {
      config.headers.Authorization = `Bearer ${currentToken.access}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    createRefreshHandler(
      () => currentToken,
      (data) => {
        if (data) {
          currentToken = data;
          onTokenRefresh?.(data);
        } else {
          onTokenRefresh?.(null);
        }
      },
      failedQueue
    )
  );

  return client;
}

export { request };

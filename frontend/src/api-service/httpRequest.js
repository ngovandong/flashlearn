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
    return { error: "Server Error" };
  }
  const token = getCurrentToken();
  if (error.response?.status === 401 && token) {
    const originalRequest = error.config;

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const { data } = await axios.post("users/refresh/", {
          refresh: token.refresh,
        });
        store.dispatch(setToken(data));
        originalRequest.headers["Authorization"] = `Bearer ${data.access}`;
        processQueue(null, data.access);
        return axios(error.config);
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

const request = axios.create();

request.interceptors.request.use(appendHeader);
// request.interceptors.request.use(appendSlash);

request.interceptors.response.use((res) => res, refreshToken);

export { request };

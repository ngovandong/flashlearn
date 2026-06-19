import { request } from "./httpRequest";

const login = (email, password) => {
  return request.post("users/login/", {
    email,
    password,
  });
};

const signUp = (user) => {
  return request.post("users/sign_up/", user);
};

const initUser = (token) => {
  const headers = {
    Authorization: token,
    "Content-Type": "application/json",
  };
  return request.get("users/init/", { headers });
};

const getUser = async () => {
  const res = await request.get("users/get_profile/");
  return res.data;
};

// Refresh + logout rely on the HttpOnly refresh cookie (sent automatically with
// withCredentials), so no token is passed in the body.
const refresh = async () => {
  const res = await request.post("users/refresh/");
  return res.data; // { access }
};

const logout = () => {
  return request.post("users/logout/");
};

// Mint a fresh {access, refresh, user} pair to hand off to the browser extension
// when an already-logged-in user connects it (the SPA can't read its own refresh
// cookie to relay). Requires the in-memory access token (sent by the interceptor).
const extensionToken = async () => {
  const res = await request.post("users/extension_token/");
  return res.data; // { access, refresh, user }
};

const authService = {
  login,
  getUser,
  signUp,
  initUser,
  refresh,
  logout,
  extensionToken,
};

export default authService;

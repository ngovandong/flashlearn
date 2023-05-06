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
  const res = await request.get("users/get_profile");
  return res.data;
};

const authService = { login, getUser, signUp, initUser };

export default authService;

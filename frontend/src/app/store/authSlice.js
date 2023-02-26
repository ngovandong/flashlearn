import { googleLogout } from "@react-oauth/google";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import authService from "@api-services/authService";
import { decodeUser } from "@utils/jwt";

export const login = createAsyncThunk("auth/login", async (user) => {
  const { email, password } = user;
  const res = await authService.login(email, password);
  if (res.data) return res.data;
  else {
    const data = res.response.data;
    if (data.message) {
      throw new Error(data.message);
    } else {
      const data = res.response.data;
      const firstKeyError = Object.keys(data)[0];
      const error = Array.isArray(data[firstKeyError])
        ? data[firstKeyError][0]
        : data[firstKeyError];
      const errorMessage = firstKeyError + ": " + error;
      throw new Error(errorMessage);
    }
  }
});
export const getUser = createAsyncThunk("auth/getUser", async () => {
  const res = await authService.getUser();
  return res;
});

let tokenString = null;
let currentWorkspace = null;
let localUser = null;
try {
  tokenString = JSON.parse(localStorage.getItem("token"));
  localUser = decodeUser(tokenString.access).user;
} catch {}

try {
  currentWorkspace = JSON.parse(localStorage.getItem("currentWorkspace"));
} catch {}

const initialState = {
  user: localUser,
  token: tokenString,
  error: "",
  currentWorkspace,
};

const userSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setError: (state, action) => {
      state.error = action.payload;
    },
    setToken: (state, action) => {
      state.token = action.payload;
      state.user = decodeUser(action.payload.access).user;
      localStorage.setItem("token", JSON.stringify(action.payload));
    },
    setCurrentWorkspace: (state, action) => {
      state.currentWorkspace = action.payload;
      localStorage.setItem("currentWorkspace", JSON.stringify(action.payload));
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      localStorage.setItem("token", null);
      googleLogout();
    },
  },
  extraReducers(builder) {
    builder
      .addCase(login.fulfilled, (state, action) => {
        state.token = action.payload;
        state.user = decodeUser(action.payload.access).user;
        localStorage.setItem("token", JSON.stringify(action.payload));
      })
      .addCase(login.rejected, (state, action) => {
        state.error = action.error.message;
      })
      .addCase(getUser.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const selectUser = (state) => state.auth.user;
export const selectToken = (state) => state.auth.token;
export const selectError = (state) => state.auth.error;
export const selectCurrentWorkspace = (state) => state.auth.currentWorkspace;

export const { logout, setToken, setCurrentWorkspace, setError } =
  userSlice.actions;
export default userSlice.reducer;

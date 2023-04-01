import { googleLogout } from "@react-oauth/google";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import authService from "@api-services/authService";
import { decodeUser } from "@utils/jwt";
import { getFirstError } from "@utils/errorHandler";

export const login = createAsyncThunk("auth/login", async (user) => {
  const { email, password } = user;
  const res = await authService.login(email, password);
  if (res.data) return res.data;
  else if (res.response) {
    const data = res.response.data;
    if (data.message) {
      throw new Error(data.message);
    } else {
      const data = res.response.data;
      const errorMessage = getFirstError(data);
      throw new Error(errorMessage);
    }
  } else {
    throw new Error("Network fail!");
  }
});
export const getUser = createAsyncThunk("auth/getUser", async () => {
  const res = await authService.getUser();
  return res;
});

let tokenString = null;
let localUser = null;
try {
  tokenString = JSON.parse(localStorage.getItem("token"));
  localUser = decodeUser(tokenString.access).user;
} catch {}

const initialState = {
  user: localUser,
  token: tokenString,
  error: "",
  loading: false,
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
    logout: (state) => {
      state.token = null;
      state.user = null;
      localStorage.setItem("token", null);
      googleLogout();
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(login.pending, (state, _) => {
        state.loading = true;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.token = action.payload;
        state.user = decodeUser(action.payload.access).user;
        localStorage.setItem("token", JSON.stringify(action.payload));
        state.loading = false;
      })
      .addCase(login.rejected, (state, action) => {
        state.error = action.error.message;
        state.loading = false;
      })
      .addCase(getUser.pending, (state, _) => {
        state.loading = true;
      })
      .addCase(getUser.rejected, (state, _) => {
        state.loading = false;
      })
      .addCase(getUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.loading = false;
      });
  },
});

export const selectUser = (state) => state.auth.user;
export const selectToken = (state) => state.auth.token;
export const selectError = (state) => state.auth.error;
export const selectLoading = (state) => state.auth.loading;

export const { logout, setToken, setError, setLoading } = userSlice.actions;
export default userSlice.reducer;

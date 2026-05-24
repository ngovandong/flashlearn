import { configureStore, createSlice } from "@reduxjs/toolkit";
import jwt_decode from "jwt-decode";

const initialState = {
  user: null,
  token: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setToken: (state, action) => {
      if (!action.payload || !action.payload.access) {
        state.token = null;
        state.user = null;
        return;
      }
      try {
        state.token = action.payload;
        state.user = jwt_decode(action.payload.access).user;
        // eslint-disable-next-line no-undef
        chrome.storage.sync.set({ token: action.payload });
      } catch (e) {
        console.error("Error decoding token:", e);
        state.token = null;
        state.user = null;
      }
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      // eslint-disable-next-line no-undef
      chrome.storage.sync.set({ token: null, default_deck: null });
    },
  },
});

export const selectUser = (state) => state.auth.user;
export const selectToken = (state) => state.auth.token;

export const { logout, setToken } = authSlice.actions;

const store = configureStore({
  reducer: { auth: authSlice.reducer },
});

// Load token from storage on startup
// eslint-disable-next-line no-undef
chrome.storage.sync.get(["token"]).then((result) => {
  if (result.token) {
    store.dispatch(setToken(result.token));
  }
});

// Reactively sync token changes from other tabs/background script
// eslint-disable-next-line no-undef
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.token) {
    const currentToken = store.getState().auth.token;
    const newToken = changes.token.newValue;
    if (JSON.stringify(currentToken) !== JSON.stringify(newToken)) {
      if (newToken) {
        store.dispatch(setToken(newToken));
      } else {
        store.dispatch(logout());
      }
    }
  }
});

export default store;


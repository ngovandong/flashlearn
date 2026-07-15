import { configureStore } from "@reduxjs/toolkit";
import { authReducer, setToken, logout } from "@/store/authSlice";
import { setAuthBridge } from "@/api/authBridge";

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

// Wire the HTTP client to the store after creation so `client.ts` never has to
// import the store directly (which would form a require cycle).
setAuthBridge({
  getAccessToken: () => store.getState().auth.token?.access ?? null,
  onTokensRefreshed: ({ access }) => store.dispatch(setToken({ access })),
  onAuthFailure: () => store.dispatch(logout()),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

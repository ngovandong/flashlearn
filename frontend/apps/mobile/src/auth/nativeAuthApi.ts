import { createAuthApi } from "@flashlearn/api";
import { request } from "@/api/client";
import { secureStorage } from "@/auth/secureStore";
import { performRefresh } from "@/auth/refresh";

// Native auth surface. Reuses the shared endpoints but persists the body refresh
// token to SecureStore on login / Google init, and refreshes/logs out with the
// body token instead of a cookie.
const base = createAuthApi(request);

export const nativeAuthApi = {
  ...base,
  async login(email: string, password: string) {
    const res: any = await base.login(email, password);
    if (!res?.error && res?.data?.refresh) {
      await secureStorage.setRefreshToken(res.data.refresh);
    }
    return res;
  },
  async initUser(idToken: string) {
    const res: any = await base.initUser(idToken);
    if (!res?.error && res?.data?.refresh) {
      await secureStorage.setRefreshToken(res.data.refresh);
    }
    return res;
  },
  refresh() {
    return performRefresh(request);
  },
  async logout() {
    const refresh = await secureStorage.getRefreshToken();
    return request.post("users/logout/", refresh ? { refresh } : {});
  },
};

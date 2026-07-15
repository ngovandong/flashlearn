import type { AxiosInstance } from "axios";
import { secureStorage } from "@/auth/secureStore";

/**
 * Native refresh: send the stored refresh token in the body (no cookies on
 * device), persist the rotated refresh token, and return the new access token.
 * Used by both the HTTP client's 401 handler and the session bootstrap thunk.
 */
export async function performRefresh(
  client: AxiosInstance
): Promise<{ access: string; refresh?: string }> {
  const refresh = await secureStorage.getRefreshToken();
  if (!refresh) throw new Error("No stored refresh token");
  const { data } = await client.post("users/refresh/", { refresh });
  if (data?.refresh) {
    await secureStorage.setRefreshToken(data.refresh);
  }
  return { access: data.access, refresh: data?.refresh };
}

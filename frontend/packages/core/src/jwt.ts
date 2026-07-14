import { jwtDecode as jwt_decode } from "jwt-decode";

import type { AuthUser, LoginPayload } from "./types";

interface DecodedToken {
  user?: AuthUser;
  [key: string]: unknown;
}

export const decodeUser = (token: string): DecodedToken =>
  jwt_decode<DecodedToken>(token);

export const resolveAuthUser = (payload: LoginPayload): AuthUser | null => {
  if (payload?.user) {
    return payload.user;
  }
  if (payload?.access) {
    const decoded = decodeUser(payload.access);
    return decoded.user ?? null;
  }
  return null;
};

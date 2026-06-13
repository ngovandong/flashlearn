import { jwtDecode as jwt_decode } from "jwt-decode";

export const decodeUser = (token) => jwt_decode(token);

export const resolveAuthUser = (payload) => {
  if (payload?.user) {
    return payload.user;
  }
  if (payload?.access) {
    const decoded = decodeUser(payload.access);
    return decoded.user ?? null;
  }
  return null;
};

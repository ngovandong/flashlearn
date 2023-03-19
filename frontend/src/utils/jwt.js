import jwt_decode from "jwt-decode";

export const decodeUser = (token) => jwt_decode(token);

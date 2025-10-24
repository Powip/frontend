import { jwtDecode } from "jwt-decode";

export interface DecodedToken {
  userId: string;
  sub: string;
  exp: number;
  iat: number;
}

export const decodeToken = (token: string): DecodedToken | null => {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
};

export const isExpired = (exp: number) => {
  const now = Math.floor(Date.now() / 1000);
  return exp < now;
};

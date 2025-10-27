"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { decodeToken, isExpired, DecodedToken } from "@/lib/jwt";

interface AuthData {
  accessToken: string;
  refreshToken: string;
  user: { email: string; id: string; role: string };
  exp: number;
}

interface AuthContextType {
  auth: AuthData | null;
  login: (tokens: { accessToken: string; refreshToken: string }) => void;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [auth, setAuth] = useState<AuthData | null>(null);

  // Cargar sesión del localStorage (si existe)
  useEffect(() => {
    const saved = localStorage.getItem("auth");
    if (saved) {
      const parsed = JSON.parse(saved);
      const decoded = decodeToken(parsed.accessToken);
      if (decoded && !isExpired(decoded.exp)) {
        setAuth({
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken,
          user: { email: decoded.email, id: decoded.id, role: decoded.role },
          exp: decoded.exp,
        });
      } else {
        localStorage.removeItem("auth");
      }
    }
  }, []);

  // ---- LOGIN ----
  const login = ({
    accessToken,
    refreshToken,
  }: {
    accessToken: string;
    refreshToken: string;
  }) => {
    const decoded = decodeToken(accessToken);
    if (!decoded) return;
    const newAuth = {
      accessToken,
      refreshToken,
      user: { email: decoded.email, id: decoded.id, role: decoded.role },
      exp: decoded.exp,
    };
    setAuth(newAuth);
    localStorage.setItem("auth", JSON.stringify(newAuth));
  };

  // ---- LOGOUT ----
  const logout = () => {
    setAuth(null);
    localStorage.removeItem("auth");
  };

  // ---- REFRESH TOKEN ----
  const refreshAccessToken = async () => {
    if (!auth) return;
    try {
      const res = await fetch("http://localhost:8080/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: auth.refreshToken }),
      });
      if (!res.ok) throw new Error("Failed to refresh token");

      const data = await res.json();
      const decoded = decodeToken(data.accessToken);
      if (!decoded) throw new Error("Invalid new token");

      const updatedAuth = {
        ...auth,
        accessToken: data.accessToken,
        exp: decoded.exp,
      };
      setAuth(updatedAuth);
      localStorage.setItem("auth", JSON.stringify(updatedAuth));
    } catch (error) {
      console.error("Error refreshing token:", error);
      logout();
    }
  };

  // ---- AUTO REFRESH ----
  useEffect(() => {
    if (!auth) return;

    const checkAndRefresh = () => {
      const now = Math.floor(Date.now() / 1000);
      const timeLeft = auth.exp - now;
      if (timeLeft < 60) refreshAccessToken(); // menos de 1 min → refresca
    };

    const interval = setInterval(checkAndRefresh, 60 * 1000); // cada minuto
    return () => clearInterval(interval);
  }, [auth]);

  return (
    <AuthContext.Provider value={{ auth, login, logout, refreshAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};

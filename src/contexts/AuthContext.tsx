"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { decodeToken, isExpired } from "@/lib/jwt";
import { getCookie, setCookie, deleteCookie } from "cookies-next";
import { fetchUserCompany } from "@/services/companyService";
import { fetchUserSubscription } from "@/services/fetchUserSubscription";

interface Subscription {
  id: string;
  status: string;
  plan: {
    id: string;
    name: string;
  };
}
interface Store {
  id: string;
  name: string;
}

interface Company {
  id: string;
  name: string;
  stores?: Store[];
}

interface AuthData {
  accessToken: string;
  refreshToken: string;
  user: { email: string; id: string; role: string };
  company: Company | null;
  subscription: Subscription | null;
  exp: number;
}

interface AuthContextType {
  auth: AuthData | null;
  login: (tokens: {
    accessToken: string;
    refreshToken: string;
  }) => Promise<AuthData | null>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
  updateCompany: (company: Company) => void;
  selectedStoreId: string | null;
  setSelectedStore: (storeId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [selectedStoreId, setSelectedStore] = useState<string | null>(null);

  // ---- Load session from cookies ----
  useEffect(() => {
    const loadFromCookies = async () => {
      const accessToken = getCookie("accessToken") as string | undefined;
      const refreshToken = getCookie("refreshToken") as string | undefined;
      const selected = getCookie("selectedStoreId");
      if (selected) setSelectedStore(selected as string);

      if (accessToken && refreshToken) {
        const decoded = decodeToken(accessToken);

        if (decoded && !isExpired(decoded.exp)) {
          const company = await fetchUserCompany(decoded.id, accessToken);
          const subscription = await fetchUserSubscription(
            decoded.id,
            accessToken
          );

          setAuth({
            accessToken,
            refreshToken,
            user: {
              email: decoded.email,
              id: decoded.id,
              role: decoded.role,
            },
            company,
            subscription,
            exp: decoded.exp,
          });
        } else {
          logout();
        }
      }
    };

    loadFromCookies();
  }, []);

  // ---- LOGIN ----
  const login = async ({
    accessToken,
    refreshToken,
  }: {
    accessToken: string;
    refreshToken: string;
  }): Promise<AuthData | null> => {
    const decoded = decodeToken(accessToken);
    if (!decoded) return null;

    const user = {
      email: decoded.email,
      id: decoded.id,
      role: decoded.role,
    };

    const company = await fetchUserCompany(decoded.id, accessToken);
    let defaultStore = null;

    if (company?.stores && company.stores.length > 0) {
      defaultStore = company.stores[0].id;
    }
    setSelectedStore(defaultStore);

    setCookie("selectedStoreId", defaultStore);

    const subscription = await fetchUserSubscription(decoded.id, accessToken);

    const newAuth: AuthData = {
      accessToken,
      refreshToken,
      user,
      company,
      subscription,
      exp: decoded.exp,
    };

    setAuth(newAuth);

    setCookie("accessToken", accessToken, { maxAge: 60 * 60 });
    setCookie("refreshToken", refreshToken, { maxAge: 60 * 60 * 24 * 7 });

    return newAuth; // 🔥 clave
  };

  // ---- LOGOUT ----
  const logout = () => {
    setAuth(null);
    deleteCookie("accessToken");
    deleteCookie("refreshToken");
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
      setCookie("accessToken", data.accessToken, { maxAge: 60 * 15 });
    } catch (error) {
      console.error("Error refreshing token:", error);
      logout();
    }
  };

  const updateCompany = (company: Company) => {
    setAuth((prev) =>
      prev
        ? {
            ...prev,
            company,
          }
        : prev
    );
  };

  // ---- AUTO REFRESH ----
  useEffect(() => {
    if (!auth) return;

    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const timeLeft = auth.exp - now;
      if (timeLeft < 60) refreshAccessToken();
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [auth]);

  return (
    <AuthContext.Provider
      value={{
        auth,
        login,
        logout,
        refreshAccessToken,
        updateCompany,
        selectedStoreId,
        setSelectedStore,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};

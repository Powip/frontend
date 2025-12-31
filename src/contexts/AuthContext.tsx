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
import { fetchUserCompany, fetchCompanyById } from "@/services/companyService";
import { fetchUserSubscription } from "@/services/fetchUserSubscription";
import axios from "axios";

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

interface Inventory {
  id: string;
  name: string;
  storeId: string;
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
  loading: boolean;
  login: (tokens: {
    accessToken: string;
    refreshToken: string;
  }) => Promise<void>;
  logout: () => void;
  updateCompany: (company: Company) => void;
  selectedStoreId: string | null;
  setSelectedStore: (storeId: string) => void;
  inventories: Inventory[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "auth-data";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStoreId, setSelectedStore] = useState<string | null>(null);
  const [inventories, setInventories] = useState<Inventory[]>([]);

  // ---- REHIDRATAR DESDE LOCALSTORAGE ----
  useEffect(() => {
    const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    const storedStore = localStorage.getItem("selectedStoreId");

    if (storedAuth) {
      const parsed: AuthData = JSON.parse(storedAuth);

      if (!isExpired(parsed.exp)) {
        setAuth(parsed);
      } else {
        logout();
      }
    }

    if (storedStore) {
      setSelectedStore(storedStore);
    }
    setLoading(false);
  }, []);

  // ---- INVENTORIES ----
  useEffect(() => {
    if (!auth?.accessToken || !selectedStoreId) return;

    const fetchInventories = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory/store/${selectedStoreId}`
        );
        setInventories(res.data);
      } catch (err) {
        console.error("Error loading inventories", err);
      }
    };

    fetchInventories();
  }, [auth, selectedStoreId]);

  // ---- LOGIN ----
  const login = async ({
    accessToken,
    refreshToken,
  }: {
    accessToken: string;
    refreshToken: string;
  }) => {
    const decoded = decodeToken(accessToken);
    if (!decoded) return;

    const user = {
      email: decoded.email,
      id: decoded.id,
      role: decoded.role,
    };

    let company = await fetchUserCompany(decoded.id, accessToken);
    
    // Si no es dueño de compañía, buscar por companyId en el token (usuarios staff)
    if (!company && decoded.companyId) {
      company = await fetchCompanyById(decoded.companyId, accessToken);
    }

    const subscription = await fetchUserSubscription(decoded.id, accessToken);

    const defaultStore =
      company?.stores && company.stores.length > 0
        ? company.stores[0].id
        : null;

    const newAuth: AuthData = {
      accessToken,
      refreshToken,
      user,
      company,
      subscription,
      exp: decoded.exp,
    };

    setAuth(newAuth);
    setSelectedStore(defaultStore);

    // 🔐 Cookies (TTL largo para demo)
    setCookie("accessToken", accessToken, { maxAge: 60 * 60 * 5 }); // 5 horas
    setCookie("refreshToken", refreshToken, { maxAge: 60 * 60 * 24 * 7 });

    // 💾 Persistencia local
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuth));
    if (defaultStore) {
      localStorage.setItem("selectedStoreId", defaultStore);
    }
  };

  const updateCompany = (company: Company) => {
    setAuth((prev) => {
      if (!prev) return prev;

      const updated = {
        ...prev,
        company,
      };

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // ---- LOGOUT ----
  const logout = () => {
    setAuth(null);
    setSelectedStore(null);
    setInventories([]);

    deleteCookie("accessToken");
    deleteCookie("refreshToken");

    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem("selectedStoreId");
  };

  return (
    <AuthContext.Provider
      value={{
        auth,
        loading,
        login,
        logout,
        selectedStoreId,
        setSelectedStore,
        inventories,
        updateCompany,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};

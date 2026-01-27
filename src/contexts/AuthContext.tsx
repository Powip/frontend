"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { decodeToken, isExpired } from "@/lib/jwt";
import { fetchUserCompany, fetchCompanyById } from "@/services/companyService";
import { fetchUserSubscription } from "@/services/fetchUserSubscription";
import axios from "axios";

// Configurar axios para enviar cookies automáticamente (httpOnly cookies)
axios.defaults.withCredentials = true;

const API_AUTH =
  process.env.NEXT_PUBLIC_API_USERS?.replace("/api/v1", "") ||
  "http://localhost:8080";

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
  // Datos adicionales para comprobante de envío
  cuit?: string; // RUC/CUIT
  billingAddress?: string; // Dirección
  phone?: string; // Teléfono
  logoUrl?: string; // URL del logo (para futuro)
}

interface AuthData {
  accessToken: string;
  user: {
    email: string;
    id: string;
    role: string;
    permissions: string[];
    name?: string;
    surname?: string;
  };
  company: Company | null;
  subscription: Subscription | null;
  exp: number;
}

interface AuthContextType {
  auth: AuthData | null;
  loading: boolean;
  login: (tokens: {
    accessToken: string;
    refreshToken?: string;
  }) => Promise<AuthData | null>;
  logout: () => void;
  updateCompany: (company: Company) => void;
  selectedStoreId: string | null;
  setSelectedStore: (storeId: string) => void;
  inventories: Inventory[];
  refreshInventories: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Solo guardamos preferencias no sensibles
const STORE_PREFERENCE_KEY = "selectedStoreId";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStoreId, setSelectedStore] = useState<string | null>(null);
  const [inventories, setInventories] = useState<Inventory[]>([]);

  // ---- SILENT REFRESH: Intenta recuperar sesión usando httpOnly cookie ----
  const silentRefresh = useCallback(async (): Promise<boolean> => {
    try {
      // Llamar al endpoint de refresh - el refreshToken viene en httpOnly cookie
      const response = await axios.post(
        `${API_AUTH}/api/v1/auth/refresh`,
        {},
        {
          withCredentials: true, // Enviar cookies
        },
      );

      if (response.data?.accessToken) {
        // Decodificar y establecer auth
        const decoded = decodeToken(response.data.accessToken);
        if (!decoded) return false;

        const user = {
          email: decoded.email,
          id: decoded.id,
          role: decoded.role,
          permissions: decoded.permissions || [],
          name: decoded.name,
          surname: decoded.surname,
        };

        let company = await fetchUserCompany(
          decoded.id,
          response.data.accessToken,
        );
        if (!company && decoded.companyId) {
          company = await fetchCompanyById(
            decoded.companyId,
            response.data.accessToken,
          );
        }

        const subscription = await fetchUserSubscription(
          decoded.id,
          response.data.accessToken,
        );

        const defaultStore = company?.stores?.[0]?.id || null;

        setAuth({
          accessToken: response.data.accessToken,
          user,
          company,
          subscription,
          exp: decoded.exp,
        });

        // Solo guardamos preferencia de tienda (no sensible)
        const storedStore = localStorage.getItem(STORE_PREFERENCE_KEY);
        setSelectedStore(storedStore || defaultStore);

        return true;
      }
    } catch (error) {
      // No hay sesión válida o refresh token expirado
      console.log("No hay sesión activa");
    }
    return false;
  }, []);

  // ---- INICIALIZACIÓN: Intentar recuperar sesión al cargar ----
  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      await silentRefresh();
      setLoading(false);
    };
    initAuth();
  }, [silentRefresh]);

  // ---- INVENTORIES ----
  const fetchInventories = async () => {
    if (!auth?.accessToken || !selectedStoreId) return;

    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory/store/${selectedStoreId}`,
      );
      setInventories(res.data);
    } catch (err) {
      console.error("Error loading inventories", err);
    }
  };

  const refreshInventories = async () => {
    await fetchInventories();
  };

  useEffect(() => {
    fetchInventories();
  }, [auth, selectedStoreId]);

  // ---- LOGIN ----
  const login = async ({
    accessToken,
  }: {
    accessToken: string;
    refreshToken?: string;
  }): Promise<AuthData | null> => {
    const decoded = decodeToken(accessToken);
    if (!decoded) return null;

    const user = {
      email: decoded.email,
      id: decoded.id,
      role: decoded.role,
      permissions: decoded.permissions || [],
      name: decoded.name,
      surname: decoded.surname,
    };

    let company = await fetchUserCompany(decoded.id, accessToken);
    if (!company && decoded.companyId) {
      company = await fetchCompanyById(decoded.companyId, accessToken);
    }

    const subscription = await fetchUserSubscription(decoded.id, accessToken);

    const defaultStore = company?.stores?.[0]?.id || null;

    const newAuth: AuthData = {
      accessToken,
      user,
      company,
      subscription,
      exp: decoded.exp,
    };

    setAuth(newAuth);
    setSelectedStore(defaultStore);

    // Solo guardamos preferencia de tienda (no sensible)
    if (defaultStore) {
      localStorage.setItem(STORE_PREFERENCE_KEY, defaultStore);
    }

    return newAuth;
  };

  const updateCompany = (company: Company) => {
    setAuth((prev) => {
      if (!prev) return prev;
      return { ...prev, company };
    });
  };

  // ---- LOGOUT ----
  const logout = async () => {
    try {
      // Llamar al backend para borrar la cookie httpOnly
      await axios.post(
        `${API_AUTH}/api/v1/auth/logout`,
        {},
        {
          withCredentials: true,
        },
      );
    } catch (error) {
      console.error("Error en logout:", error);
    }

    setAuth(null);
    setSelectedStore(null);
    setInventories([]);
    localStorage.removeItem(STORE_PREFERENCE_KEY);
  };

  // ---- CHECK PERMISSION ----
  const hasPermission = (permission: string): boolean => {
    return auth?.user.permissions?.includes(permission) ?? false;
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
        refreshInventories,
        updateCompany,
        hasPermission,
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

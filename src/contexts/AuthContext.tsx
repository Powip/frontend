"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { fetchUserCompany, fetchCompanyById } from "@/services/companyService";
import { fetchUserSubscription } from "@/services/fetchUserSubscription";
import { decodeToken } from "@/lib/jwt";
import axios from "axios";
import axiosAuth, { requestRefresh } from "@/lib/axiosAuth";
import { isSuperadmin } from "@/config/permissions.config";
import { tokenStore } from "@/lib/tokenStore";
import { GATEWAY } from "@/lib/gateway";

const API_AUTH = GATEWAY.auth;

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
  cuit?: string;
  billingAddress?: string;
  phone?: string;
  logoUrl?: string;
  sales_channels?: string[];
  closing_channels?: string[];
  iva?: number;
  powipCommissionRate?: number;
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
    companyId?: string;
  };
  // Company = tiene empresa | null = confirmado que no tiene empresa (404) | undefined = no se pudo verificar (error de red/401/etc.)
  company: Company | null | undefined;
  // true = suscripto | false = sin suscripción confirmada (404/403) | null = no verificado (error de red)
  subscription: boolean | null;
}

interface AuthContextType {
  auth: AuthData | null;
  loading: boolean;
  login: (tokens: { accessToken: string }) => Promise<AuthData | null>;
  logout: () => Promise<void>;
  updateCompany: (company: Company) => void;
  updateSubscription: (subscription: boolean) => void;
  refreshAuth: () => Promise<AuthData | null>;
  selectedStoreId: string | null;
  setSelectedStore: (storeId: string) => void;
  inventories: Inventory[];
  refreshInventories: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORE_PREFERENCE_KEY = "selectedStoreId";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStoreId, setSelectedStore] = useState<string | null>(null);
  const [inventories, setInventories] = useState<Inventory[]>([]);

  // ---- RESTORE AUTH ----
  const restoreAuthFromToken = useCallback(async (accessToken: string): Promise<AuthData | null> => {
    const decoded = decodeToken(accessToken);
    if (!decoded) return null;

    tokenStore.set(accessToken);

    const user = {
      email: decoded.email,
      id: decoded.id,
      role: decoded.role,
      permissions: decoded.permissions || [],
      name: decoded.name,
      surname: decoded.surname,
      companyId: decoded.companyId,
    };

    let company: Company | null | undefined = null;
    try {
      if (decoded.id) {
        company = await fetchUserCompany(decoded.id);
      }
      if (!company && decoded.companyId) {
        company = await fetchCompanyById(decoded.companyId);
      }
    } catch {
      // Error de red — la empresa puede existir pero no se pudo verificar
      company = undefined;
    }

    let subscription: boolean | null = null;
    try {
      const result = await fetchUserSubscription();
      // null (404/403) → false: sin suscripción confirmada
      // true → suscripto
      subscription = result ?? false;
    } catch {
      // Error de red → null: no verificado, no redirigir a /sin-plan
    }

    const defaultStore = company?.stores?.[0]?.id || null;
    const authData: AuthData = { accessToken, user, company, subscription };
    setAuth(authData);

    const storedStore = localStorage.getItem(STORE_PREFERENCE_KEY);
    setSelectedStore(storedStore || defaultStore);

    return authData;
  }, []);

  // ---- SILENT REFRESH ----
  // Devuelve el AuthData ya actualizado (o null si falla) en lugar de un boolean,
  // ya que setAuth() es asíncrono: el caller no puede confiar en el `auth` del
  // closure justo después de awaitear el refresh, necesita el valor devuelto.
  const silentRefresh = useCallback(async (): Promise<AuthData | null> => {
    // El access token ya no se persiste en localStorage — el refresh siempre
    // va al backend, que lee la cookie httpOnly.
    const newToken = await requestRefresh();
    if (newToken) {
      return restoreAuthFromToken(newToken);
    }
    return null;
  }, [restoreAuthFromToken]);

  // ---- INICIALIZACIÓN ----
  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      await silentRefresh();
      setLoading(false);
    };
    initAuth();
  }, [silentRefresh]);

  // ---- TOKEN STORE: Sincronizar token para uso en servicios HTTP ----
  useEffect(() => {
    tokenStore.set(auth?.accessToken ?? null);
  }, [auth?.accessToken]);

  // ---- INTERCEPTOR EVENTS ----
  useEffect(() => {
    const onRefreshed = (e: Event) => {
      const newToken = (e as CustomEvent<string>).detail;
      setAuth((prev) => (prev ? { ...prev, accessToken: newToken } : null));
    };
    const onLogout = () => {
      setAuth(null);
      setSelectedStore(null);
      setInventories([]);
      tokenStore.set(null);
      localStorage.removeItem(STORE_PREFERENCE_KEY);
    };
    window.addEventListener("auth:refreshed", onRefreshed);
    window.addEventListener("auth:logout", onLogout);
    return () => {
      window.removeEventListener("auth:refreshed", onRefreshed);
      window.removeEventListener("auth:logout", onLogout);
    };
  }, []);

  // ---- INVENTORIES ----
  // OJO: dependemos de `auth?.user?.id` (estable durante la sesión), NO de
  // `auth?.accessToken`. axiosAuth ya lee el token vigente desde tokenStore
  // en cada request via su interceptor, así que este callback no necesita el
  // accessToken para funcionar. Si dependiera de él, cada refresh de token
  // dispararía este efecto de nuevo; si el endpoint de inventario devuelve 401
  // por cualquier motivo (p. ej. permisos/rol aún no propagados tras crear
  // una empresa), el interceptor 401 refresca el token → cambia accessToken →
  // el efecto se re-dispara → nuevo 401 → nuevo refresh → loop infinito, que
  // termina agotando la rotación del refresh token en el backend (esto es lo
  // que causaba el InvalidRefreshTokenError después de ~40 refreshes).
  const fetchInventories = useCallback(async () => {
    if (!auth?.user?.id || !selectedStoreId) return;
    try {
      const res = await axiosAuth.get(
        `${GATEWAY.logistics}/inventory/store/${selectedStoreId}`,
      );
      setInventories(res.data);
    } catch {
      // silently fail — inventarios no bloquean el funcionamiento
    }
  }, [auth?.user?.id, selectedStoreId]);

  const refreshInventories = useCallback(async () => {
    await fetchInventories();
  }, [fetchInventories]);

  useEffect(() => {
    fetchInventories();
  }, [fetchInventories]);

  // ---- LOGIN ----
  const login = async ({
    accessToken,
  }: {
    accessToken: string;
  }): Promise<AuthData | null> => {
    const authData = await restoreAuthFromToken(accessToken);
    if (!authData) {
      tokenStore.set(null);
      return null;
    }

    if (authData.company?.stores?.[0]?.id) {
      localStorage.setItem(STORE_PREFERENCE_KEY, authData.company.stores[0].id);
    }

    return authData;
  };

  const updateCompany = (company: Company) => {
    setAuth((prev) => {
      if (!prev) return prev;
      return { ...prev, company };
    });
  };

  const updateSubscription = (subscription: boolean) => {
    setAuth((prev) => {
      if (!prev) return prev;
      return { ...prev, subscription };
    });
  };

  // ---- LOGOUT ----
  const logout = async () => {
    try {
      await axios.post(
        `${API_AUTH}/api/v1/auth/logout`,
        {},
        { withCredentials: true },
      );
    } catch {
      // Ignorar errores de red en logout — el estado local se limpia de todas formas
    }

    setAuth(null);
    setSelectedStore(null);
    setInventories([]);
    tokenStore.set(null);
    localStorage.removeItem(STORE_PREFERENCE_KEY);
  };

  // ---- CHECK PERMISSION ----
  const hasPermission = (permission: string): boolean => {
    if (isSuperadmin(auth?.user?.email)) return true;
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
        updateSubscription,
        refreshAuth: silentRefresh,
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

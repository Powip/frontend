"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { decodeToken, isExpired } from "@/lib/jwt";
import { fetchUserCompany, fetchCompanyById } from "@/services/companyService";
import { fetchUserSubscription } from "@/services/fetchUserSubscription";
import axios from "axios";
import { isSuperadmin } from "@/config/permissions.config";
import { tokenStore } from "@/lib/tokenStore";
import { partnersKeys } from "@/features/partners/keys/partners.keys";

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
    /** companyId del JWT (dueños y personal con empresa asignada). */
    companyId?: string | null;
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
  /** Relee la suscripción (ej. al confirmarse el pago del onboarding). */
  refreshSubscription: () => Promise<void>;
  /**
   * Pide a ms-auth un access token nuevo (cookie de refresh) y recarga empresa y
   * suscripción. Necesario cuando cambian datos que viajan en el JWT: al pagar el
   * usuario pasa a ADMINISTRADOR y al crear la empresa recibe su companyId.
   */
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Solo guardamos preferencias no sensibles
const STORE_PREFERENCE_KEY = "selectedStoreId";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStoreId, setSelectedStore] = useState<string | null>(null);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const currentUserId = useRef<string | null>(null);
  const sessionVersion = useRef(0);

  const setSession = useCallback((nextAuth: AuthData | null, clearPartners = false) => {
    const nextUserId = nextAuth?.user.id ?? null;
    if (clearPartners || currentUserId.current !== nextUserId) {
      void queryClient.cancelQueries({ queryKey: partnersKeys.all });
      queryClient.removeQueries({ queryKey: partnersKeys.all });
      const mutationCache = queryClient.getMutationCache();
      mutationCache.findAll({ mutationKey: partnersKeys.all }).forEach((mutation) => {
        mutationCache.remove(mutation);
      });
    }
    currentUserId.current = nextUserId;
    // Publish the bearer before any query can render with the new user's key.
    tokenStore.set(nextAuth?.accessToken ?? null);
    setAuth(nextAuth);
  }, [queryClient]);

  // ---- SILENT REFRESH: Intenta recuperar sesión usando httpOnly cookie ----
  const silentRefresh = useCallback(async (): Promise<boolean> => {
    const refreshingSession = ++sessionVersion.current;
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
          companyId: decoded.companyId ?? null,
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

        if (refreshingSession !== sessionVersion.current) return false;

        setSession({
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
  }, [setSession]);

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
  const fetchInventories = useCallback(async () => {
    if (!auth?.accessToken || !selectedStoreId) return;

    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory/store/${selectedStoreId}`,
      );
      setInventories(res.data);
    } catch (err) {
      console.error("Error loading inventories", err);
    }
  }, [auth?.accessToken, selectedStoreId]);

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
    refreshToken?: string;
  }): Promise<AuthData | null> => {
    const decoded = decodeToken(accessToken);
    if (!decoded) return null;
    const loggingInSession = ++sessionVersion.current;

    const user = {
      email: decoded.email,
      id: decoded.id,
      role: decoded.role,
      permissions: decoded.permissions || [],
      name: decoded.name,
      surname: decoded.surname,
      companyId: decoded.companyId ?? null,
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

    if (loggingInSession !== sessionVersion.current) return null;

    setSession(newAuth, true);
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
    ++sessionVersion.current;
    setSession(null, true);
    setSelectedStore(null);
    setInventories([]);
    try {
      localStorage.removeItem(STORE_PREFERENCE_KEY);
    } catch {
      // A blocked preference store must not prevent server-side logout.
    }

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
  };

  // ---- REFRESH SUBSCRIPTION ----
  const refreshSubscription = useCallback(async () => {
    if (!auth?.accessToken) return;
    const userId = auth.user.id;
    const accessToken = auth.accessToken;
    const refreshingSession = sessionVersion.current;
    if (currentUserId.current !== userId || tokenStore.get() !== accessToken) return;

    const subscription = await fetchUserSubscription(userId, accessToken);
    setAuth((prev) => {
      // A retained callback or late response must not modify another session.
      if (
        refreshingSession !== sessionVersion.current ||
        tokenStore.get() !== accessToken ||
        !prev ||
        prev.user.id !== userId ||
        prev.accessToken !== accessToken
      ) return prev;
      return { ...prev, subscription };
    });
  }, [auth?.accessToken, auth?.user.id]);

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
        hasPermission,
        refreshSubscription,
        refreshSession: silentRefresh,
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

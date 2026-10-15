"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { decodeToken, isExpired } from "@/lib/jwt";
import { fetchUserCompany, fetchCompanyById } from "@/services/companyService";
import { fetchUserSubscription } from "@/services/fetchUserSubscription";
import axios from "axios";
import { GATEWAY } from "@/lib/gateway";
import { isSuperadmin } from "@/config/permissions.config";
import { tokenStore } from "@/lib/tokenStore";
import {
  cancelSessionRefresh,
  registerSessionRefresher,
  requestSessionToken,
} from "@/lib/sessionRefresh";
import { partnersKeys } from "@/features/partners/keys/partners.keys";

// Configurar axios para enviar cookies automáticamente (httpOnly cookies)
axios.defaults.withCredentials = true;

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

type InventoryResponse = Omit<Inventory, "storeId"> & { storeId?: string; store_id?: string };

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

function readStorePreference(): string | null {
  try {
    return localStorage.getItem(STORE_PREFERENCE_KEY);
  } catch {
    return null;
  }
}

function saveStorePreference(storeId: string | null): void {
  try {
    if (storeId) localStorage.setItem(STORE_PREFERENCE_KEY, storeId);
    else localStorage.removeItem(STORE_PREFERENCE_KEY);
  } catch {
    // Optional preferences must not block a valid session in restricted browsers.
  }
}

const resolveSelectedStoreId = (
  stores: Store[] | undefined,
  preferredStoreId: string | null,
): string | null =>
  stores?.find((store) => store.id === preferredStoreId)?.id ||
  stores?.[0]?.id ||
  null;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [auth, setAuth] = useState<AuthData | null>(null);
  const authRef = useRef<AuthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferredStoreId, setPreferredStoreId] = useState<string | null>(null);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const currentUserId = useRef<string | null>(null);
  const sessionVersion = useRef(0);
  const refreshRequest = useRef<{
    version: number;
    promise: Promise<boolean>;
  } | null>(null);
  const inventoryRequestVersion = useRef(0);

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
    authRef.current = nextAuth;
    const scope = nextAuth
      ? JSON.stringify([nextAuth.user.id, nextAuth.company?.id ?? nextAuth.user.companyId ?? null])
      : null;
    tokenStore.set(nextAuth?.accessToken ?? null, scope);
    setAuth(nextAuth);
  }, [queryClient]);

  // Todos los consumidores consultan la misma tienda válida del negocio actual.
  const selectedStoreId = resolveSelectedStoreId(
    auth?.company?.stores,
    preferredStoreId,
  );

  const setSelectedStore = useCallback(
    (storeId: string) => {
      if (auth?.company?.stores?.some((store) => store.id === storeId)) {
        setPreferredStoreId(storeId);
      }
    },
    [auth?.company?.stores],
  );

  useEffect(() => {
    if (!auth) return;

    // También corrige preferencias de tiendas eliminadas o de otro negocio.
    if (preferredStoreId !== selectedStoreId) {
      setPreferredStoreId(selectedStoreId);
    }
    saveStorePreference(selectedStoreId);
  }, [auth, preferredStoreId, selectedStoreId]);

  // ---- SILENT REFRESH: Intenta recuperar sesión usando httpOnly cookie ----
  const silentRefresh = useCallback((): Promise<boolean> => {
    const inFlight = refreshRequest.current;
    if (inFlight && inFlight.version === sessionVersion.current) return inFlight.promise;
    const refreshingSession = ++sessionVersion.current;
    const session = tokenStore.snapshot();
    const promise = (async (): Promise<boolean> => {
      try {
        const accessToken = await requestSessionToken(session);
        if (accessToken) {
          // Decodificar y establecer auth
          const decoded = decodeToken(accessToken);
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
            accessToken,
          );
          if (!company && decoded.companyId) {
            company = await fetchCompanyById(
              decoded.companyId,
              accessToken,
            );
          }

          const subscription = await fetchUserSubscription(
            decoded.id,
            accessToken,
          );

          const currentBearer = tokenStore.get();
          if (
            refreshingSession !== sessionVersion.current || !tokenStore.isCurrent(session) ||
            (currentBearer !== session.token && currentBearer !== accessToken)
          ) return false;

          setSession({
            accessToken,
            user,
            company,
            subscription,
            exp: decoded.exp,
          });

          // Solo guardamos preferencia de tienda (no sensible)
          const storedStore = readStorePreference();
          setPreferredStoreId(
            resolveSelectedStoreId(company?.stores, storedStore),
          );

          return true;
        }
      } catch {
        // No hay sesión válida o refresh token expirado
        console.log("No hay sesión activa");
      }
      return false;
    })().finally(() => {
      if (refreshRequest.current?.version === refreshingSession) refreshRequest.current = null;
    });
    refreshRequest.current = { version: refreshingSession, promise };
    return promise;
  }, [setSession]);

  const renewAccessToken = useCallback(async (): Promise<boolean> => {
    const previous = authRef.current;
    const session = tokenStore.snapshot();
    const renewingVersion = sessionVersion.current;
    if (!previous || !session.active || !session.token) return false;
    const accessToken = await requestSessionToken(session);
    if (!accessToken || !tokenStore.isCurrent(session) || renewingVersion !== sessionVersion.current) {
      return false;
    }
    const decoded = decodeToken(accessToken);
    const current = authRef.current;
    // Automatic retries must keep the account and company that issued the
    // original request. Explicit public refresh can still adopt onboarding changes.
    if (
      !decoded || !current || !Number.isFinite(decoded.exp) || isExpired(decoded.exp) ||
      decoded.id !== current.user.id ||
      (decoded.companyId ?? null) !== (current.user.companyId ?? null)
    ) return false;
    setSession({
      ...current,
      accessToken,
      user: {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions || [],
        name: decoded.name,
        surname: decoded.surname,
        companyId: decoded.companyId ?? null,
      },
      exp: decoded.exp,
    });
    return true;
  }, [setSession]);

  useEffect(() => registerSessionRefresher(renewAccessToken), [renewAccessToken]);

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
  const fetchInventories = useCallback(async (signal?: AbortSignal) => {
    const requestVersion = ++inventoryRequestVersion.current;
    const requestingSession = sessionVersion.current;
    if (!auth?.accessToken || !selectedStoreId) {
      setInventories([]);
      return;
    }

    try {
      const res = await axios.get<InventoryResponse[]>(
        `${process.env.NEXT_PUBLIC_API_INVENTORY || GATEWAY.logistics}/inventory/store/${selectedStoreId}`,
        { headers: { Authorization: `Bearer ${auth.accessToken}` }, signal },
      );
      if (requestVersion === inventoryRequestVersion.current && requestingSession === sessionVersion.current && !signal?.aborted) {
        setInventories(Array.isArray(res.data) ? res.data
          .map((inventory) => ({ ...inventory, storeId: inventory.storeId ?? inventory.store_id ?? "" }))
          .filter((inventory) => inventory.storeId === selectedStoreId) : []);
      }
    } catch (err) {
      if (signal?.aborted || requestVersion !== inventoryRequestVersion.current || requestingSession !== sessionVersion.current) return;
      setInventories([]);
      console.error("Error loading inventories", err);
    }
  }, [auth?.accessToken, selectedStoreId]);

  const refreshInventories = useCallback(async () => {
    await fetchInventories();
  }, [fetchInventories]);

  useEffect(() => {
    const controller = new AbortController();
    setInventories([]);
    void fetchInventories(controller.signal);
    return () => controller.abort();
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
    // Cancel an older cookie rotation before replacing the session.
    cancelSessionRefresh();
    tokenStore.invalidate();
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
    setPreferredStoreId(defaultStore);

    // Solo guardamos preferencia de tienda (no sensible)
    if (defaultStore) saveStorePreference(defaultStore);

    return newAuth;
  };

  const updateCompany = (company: Company) => {
    const previous = authRef.current;
    if (!previous) return;
    if (previous.company?.id !== company.id) {
      cancelSessionRefresh();
      tokenStore.invalidate();
      refreshRequest.current = null;
    }
    setSession({ ...previous, company });
  };

  // ---- LOGOUT ----
  const logout = async () => {
    const accessToken = tokenStore.get();
    // A late refresh response must not restore the cookie after logout.
    cancelSessionRefresh();
    ++sessionVersion.current;
    setSession(null, true);
    setPreferredStoreId(null);
    setInventories([]);
    saveStorePreference(null);

    try {
      // Llamar al backend para borrar la cookie httpOnly
      await axios.post(
        "/api/auth/logout",
        {},
        {
          withCredentials: true,
          ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
        },
      );
    } catch {
      console.error("No pudimos confirmar el cierre de sesión con el servidor.");
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
    const prev = authRef.current;
      // A retained callback or late response must not modify another session.
      if (
        refreshingSession !== sessionVersion.current ||
        tokenStore.get() !== accessToken ||
        !prev ||
        prev.user.id !== userId ||
        prev.accessToken !== accessToken
      ) return;
      setSession({ ...prev, subscription });
  }, [auth?.accessToken, auth?.user.id, setSession]);

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

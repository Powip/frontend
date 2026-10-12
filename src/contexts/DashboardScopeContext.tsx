"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { hasAdminAccess, isSuperadmin } from "@/config/permissions.config";
import { useAuth } from "./AuthContext";

export type DashboardScope = "business" | "store";

export type DashboardScopeParams =
  | { storeIds: string; storeId?: never }
  | { storeId: string; storeIds?: never };

interface DashboardScopeValue {
  scope: DashboardScope;
  setScope: (scope: DashboardScope) => void;
  storeIds: string[];
  scopeParams: DashboardScopeParams;
  canFetch: boolean;
}

interface ScopeChoice {
  userId: string | undefined;
  companyId: string | undefined;
  scope: DashboardScope;
}

const DashboardScopeContext = createContext<DashboardScopeValue | undefined>(
  undefined,
);

export function DashboardScopeProvider({ children }: { children: ReactNode }) {
  const { auth, selectedStoreId } = useAuth();
  const userId = auth?.user?.id;
  const companyId = auth?.company?.id;
  const companyStores = auth?.company?.stores;
  const canViewBusiness =
    hasAdminAccess(auth?.user?.role) || isSuperadmin(auth?.user?.email);
  const [choice, setChoice] = useState<ScopeChoice | null>(null);

  const currentChoice =
    choice && choice.userId === userId && choice.companyId === companyId
      ? choice.scope
      : undefined;
  const scope: DashboardScope = canViewBusiness
    ? currentChoice || "business"
    : "store";

  const setScope = useCallback(
    (nextScope: DashboardScope) => {
      if (nextScope === "business" && !canViewBusiness) return;
      setChoice({ userId, companyId, scope: nextScope });
    },
    [userId, companyId, canViewBusiness],
  );

  const storeIds = useMemo(() => {
    const businessStoreIds = Array.from(
      new Set(companyStores?.map((store) => store.id).filter(Boolean) || []),
    ).sort();

    if (scope === "business") return businessStoreIds;
    return selectedStoreId && businessStoreIds.includes(selectedStoreId)
      ? [selectedStoreId]
      : [];
  }, [companyStores, scope, selectedStoreId]);

  const scopeParams = useMemo<DashboardScopeParams>(
    () => scope === "business"
      ? { storeIds: storeIds.join(",") }
      : { storeId: storeIds[0] || "" },
    [scope, storeIds],
  );
  const canFetch = Boolean(auth?.accessToken && userId && storeIds.length > 0);

  const value = useMemo(
    () => ({ scope, setScope, storeIds, scopeParams, canFetch }),
    [scope, setScope, storeIds, scopeParams, canFetch],
  );

  return (
    <DashboardScopeContext.Provider value={value}>
      {children}
    </DashboardScopeContext.Provider>
  );
}

export function useDashboardScope(): DashboardScopeValue {
  const context = useContext(DashboardScopeContext);
  if (!context) {
    throw new Error("useDashboardScope must be used within DashboardScopeProvider");
  }
  return context;
}

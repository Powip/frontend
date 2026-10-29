"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";

export type DashboardScope = "business" | "store";

export type DashboardScopeParams = { currency?: string } & (
  | { storeIds: string; storeId?: never }
  | { storeId: string; storeIds?: never });

interface DashboardScopeValue {
  scope: DashboardScope;
  setScope: (scope: DashboardScope) => void;
  storeIds: string[];
  scopeParams: DashboardScopeParams;
  canFetch: boolean;
  canViewBusiness: boolean;
  currency: string;
  setCurrency: (currency: string) => void;
  scopeKey: string;
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
  const canViewBusiness = Boolean(auth?.accessToken && userId && companyId);
  const [currencyChoice, setCurrencyChoice] = useState<{userId: string | undefined; companyId: string | undefined; currency: string} | null>(null);
  const currency = currencyChoice && currencyChoice.userId === userId && currencyChoice?.companyId === companyId ? currencyChoice.currency : "PEN";
  const setCurrency = useCallback((next: string) => { if (/^(?:[A-Z]{3}|UNKNOWN)$/.test(next)) setCurrencyChoice({userId,companyId,currency:next}); },[userId,companyId]);
  const [choice, setChoice] = useState<ScopeChoice | null>(null);

  useEffect(() => {
    setChoice((current) =>
      canViewBusiness && current?.userId === userId && current?.companyId === companyId
        ? current
        : null,
    );
  }, [canViewBusiness, userId, companyId]);

  const currentChoice =
    choice && choice.userId === userId && choice.companyId === companyId
      ? choice.scope
      : undefined;
  const scope: DashboardScope = canViewBusiness
    ? currentChoice || "business"
    : "store";

  const setScope = useCallback(
    (nextScope: DashboardScope) => {
      if (!canViewBusiness) return;
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
    () => ({ ...(scope === "business"
      ? { storeIds: storeIds.join(",") }
      : { storeId: storeIds[0] || "" }), ...(currency !== "PEN" ? {currency} : {}) }),
    [scope, storeIds, currency],
  );
  const canFetch = canViewBusiness && storeIds.length > 0;
  const scopeKey = JSON.stringify([companyId, userId, scope, storeIds]);

  const value = useMemo(
    () => ({ scope, setScope, storeIds, scopeParams, canFetch, canViewBusiness, scopeKey, currency, setCurrency }),
    [scope, setScope, storeIds, scopeParams, canFetch, canViewBusiness, scopeKey, currency, setCurrency],
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

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import { getDashboardOrdersCount } from "@/services/dashboardService";
import type { OrderStatus } from "@/interfaces/IOrder";

// Solo la cantidad de pedidos del rango: evita bajar la lista completa para mostrar un número.
export function useBusinessOrdersCount(
  fromDate: string | undefined,
  toDate: string | undefined,
  options: { statuses?: OrderStatus[]; includeCcLeads?: boolean; enabled?: boolean } = {},
) {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const companyId = auth?.company?.id;
  useEffect(() => {
    const changed = (event: Event) => {
      if (companyId && (event as CustomEvent<{ companyId?: string }>).detail?.companyId === companyId) {
        void queryClient.invalidateQueries({ queryKey: ["business-orders", companyId, "count"] }, { cancelRefetch: false });
      }
    };
    window.addEventListener("commercial-leads:changed", changed);
    return () => window.removeEventListener("commercial-leads:changed", changed);
  }, [companyId, queryClient]);
  const { storeIds, canFetch } = useBusinessScope();
  const enabled = canFetch && options.enabled !== false;
  const includeCcLeads = options.includeCcLeads ?? false;
  const statuses = options.statuses;
  const query = useQuery({
    queryKey: ["business-orders", companyId, "count", auth?.user?.id, storeIds, fromDate, toDate, includeCcLeads, statuses],
    enabled,
    queryFn: ({ signal }) => getDashboardOrdersCount(storeIds, fromDate, toDate, auth!.accessToken, { signal, includeCcLeads, statuses }),
    retry: false,
    staleTime: 60_000,
  });
  const refetch = query.refetch;
  const retry = useCallback(() => refetch(), [refetch]);
  const error = enabled && query.isError;
  return {
    count: enabled && !error ? query.data ?? null : null,
    loading: enabled && query.isPending,
    error,
    retry,
    refetch,
  };
}

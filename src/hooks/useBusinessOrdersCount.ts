"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
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
  const { storeIds, canFetch } = useBusinessScope();
  const enabled = canFetch && options.enabled !== false;
  const includeCcLeads = options.includeCcLeads ?? false;
  const statuses = options.statuses;
  const query = useQuery({
    queryKey: ["business-orders", "count", auth?.company?.id, auth?.user?.id, storeIds, fromDate, toDate, includeCcLeads, statuses],
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

"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardScope } from "@/contexts/DashboardScopeContext";
import { getDashboardOrders } from "@/services/dashboardService";

export function useMetricOrders(fromDate?: string, toDate?: string) {
  const { auth } = useAuth();
  const { storeIds, canFetch, currency } = useDashboardScope();
  const queryClient = useQueryClient();
  const companyId = auth?.company?.id;
  useEffect(() => {
    const changed = (event: Event) => {
      if (
        companyId &&
        (event as CustomEvent<{ companyId: string }>).detail?.companyId ===
          companyId
      )
        void queryClient.invalidateQueries({
          queryKey: ["business-metric-orders", companyId],
        });
    };
    window.addEventListener("commercial-leads:changed", changed);
    return () =>
      window.removeEventListener("commercial-leads:changed", changed);
  }, [companyId, queryClient]);
  const query = useQuery({
    queryKey: [
      "business-metric-orders",
      auth?.company?.id,
      auth?.user?.id,
      auth?.user?.role,
      auth?.user?.permissions,
      storeIds,
      currency,
      fromDate,
      toDate,
    ],
    enabled: canFetch,
    queryFn: ({ signal }) =>
      getDashboardOrders(storeIds, fromDate, toDate, auth!.accessToken, {
        signal,
        includeCcLeads: true,
        currency,
      }),
    retry: false,
    staleTime: 60_000,
  });

  return {
    orders: query.data ?? [],
    loading: query.isPending,
    error: query.isError,
    retry: () => {
      void query.refetch();
    },
  };
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardScope } from "@/contexts/DashboardScopeContext";
import { getDashboardOrders } from "@/services/dashboardService";

export function useMetricOrders(fromDate?: string, toDate?: string) {
  const { auth } = useAuth();
  const { storeIds, canFetch } = useDashboardScope();
  const query = useQuery({
    queryKey: ["business-metric-orders", auth?.company?.id, auth?.user?.id, storeIds, fromDate, toDate],
    enabled: canFetch,
    queryFn: ({ signal }) => getDashboardOrders(storeIds, fromDate, toDate, auth!.accessToken, { signal, includeCcLeads: true }),
    retry: false,
    staleTime: 60_000,
  });

  return { orders: query.data ?? [], loading: query.isPending, error: query.isError, retry: () => { void query.refetch(); } };
}

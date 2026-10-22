"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import { getDashboardOrders } from "@/services/dashboardService";
import type { OrderHeader, OrderStatus } from "@/interfaces/IOrder";

const EMPTY_ORDERS: OrderHeader[] = [];

export function useBusinessOrders(fromDate?: string, toDate?: string, options?: { includeCcLeads?: boolean; includeCommercialLeads?: boolean; enabled?: boolean; statuses?: OrderStatus[] }) {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const companyId = auth?.company?.id;
  useEffect(() => {
    const changed = (event: Event) => { if (companyId && (event as CustomEvent<{companyId?: string}>).detail?.companyId === companyId) void queryClient.invalidateQueries({queryKey: ["business-orders", companyId]}, { cancelRefetch: false }); };
    window.addEventListener("commercial-leads:changed", changed);
    return () => window.removeEventListener("commercial-leads:changed", changed);
  }, [companyId, queryClient]);
  const { storeIds, canFetch } = useBusinessScope();
  const enabled = canFetch && options?.enabled !== false;
  const includeCcLeads = options?.includeCcLeads ?? false;
  const includeCommercialLeads = options?.includeCommercialLeads ?? false;
  const statuses = options?.statuses;
  const query = useQuery({
    queryKey: ["business-orders", auth?.company?.id, auth?.user?.id, storeIds, fromDate, toDate, includeCcLeads, includeCommercialLeads, statuses],
    enabled,
    queryFn: ({ signal }) => getDashboardOrders<OrderHeader>(storeIds, fromDate, toDate, auth!.accessToken, { signal, includeCcLeads, includeCommercialLeads, statuses }),
    retry: false,
    staleTime: 60_000,
  });
  const stores = auth?.company?.stores;
  const refetch = query.refetch;
  const retry = useCallback(() => refetch(), [refetch]);
  const orders = useMemo(() => {
    if (!enabled || !query.data) return EMPTY_ORDERS;
    const names = new Map(stores?.map((store) => [store.id, store.name]));
    return query.data.map((order) => ({ ...order, storeName: names.get(order.storeId) ?? order.storeName, stockStoreName: order.stockStoreId ? names.get(order.stockStoreId) ?? order.stockStoreName : undefined }));
  }, [enabled, query.data, stores]);
  return {
    orders,
    loading: enabled && query.isPending,
    error: enabled && query.isError,
    retry,
    refetch: query.refetch,
  };
}

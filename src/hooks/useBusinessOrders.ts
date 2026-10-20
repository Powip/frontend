"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import { getDashboardOrders } from "@/services/dashboardService";
import type { OrderHeader, OrderStatus } from "@/interfaces/IOrder";

const EMPTY_ORDERS: OrderHeader[] = [];

export function useBusinessOrders(fromDate?: string, toDate?: string, options?: { includeCcLeads?: boolean; enabled?: boolean; statuses?: OrderStatus[] }) {
  const { auth } = useAuth();
  const { storeIds, canFetch } = useBusinessScope();
  const enabled = canFetch && options?.enabled !== false;
  const includeCcLeads = options?.includeCcLeads ?? false;
  const statuses = options?.statuses;
  const query = useQuery({
    queryKey: ["business-orders", auth?.company?.id, auth?.user?.id, storeIds, fromDate, toDate, includeCcLeads, ...(statuses ? [statuses] : [])],
    enabled,
    queryFn: ({ signal }) => getDashboardOrders<OrderHeader>(storeIds, fromDate, toDate, auth!.accessToken, { signal, includeCcLeads, statuses }),
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

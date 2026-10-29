"use client";

import { useQuery, type RefetchOptions } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { useBusinessOrders } from "./useBusinessOrders";

const EMPTY_GUIDES: never[] = [];

type GuideScopeFields = { storeId?: string; orderIds?: string[] };

export function useBusinessGuides<T extends { id: string }>(options?: { includeAllStores?: boolean }) {
  const { auth } = useAuth();
  const { scope, storeIds, canFetch } = useBusinessScope();
  const companyStores = auth?.company?.stores;
  const companyStoreIds = useMemo(
    () => Array.from(new Set(companyStores?.map((store) => store.id).filter(Boolean) ?? [])).sort(),
    [companyStores],
  );
  const enabled = Boolean(
    canFetch && auth?.accessToken && auth.company?.id && auth.user?.id &&
    companyStoreIds.length > 0 && storeIds.length > 0 &&
    storeIds.every((id) => companyStoreIds.includes(id)),
  );
  const needsScopedOrders = enabled && scope === "store" && !options?.includeAllStores;
  const orderQuery = useBusinessOrders(undefined, undefined, { enabled: needsScopedOrders });
  const query = useQuery({
    queryKey: ["business-guides", auth?.company?.id, auth?.user?.id, enabled ? companyStoreIds : []],
    enabled,
    queryFn: async ({ signal }) => {
      if (!enabled) return [];
      // La tienda propietaria puede ser distinta de la tienda de un pedido
      // incluido: consultar todo el catálogo permite encontrar guías compartidas.
      const responses = await Promise.all(companyStoreIds.map((storeId) => axiosAuth.get<(T & GuideScopeFields)[]>(
        `${process.env.NEXT_PUBLIC_API_COURIER || GATEWAY.courier}/shipping-guides/store/${storeId}`,
        { signal, headers: { Authorization: `Bearer ${auth!.accessToken}` } },
      )));
      if (responses.some((response) => !Array.isArray(response.data))) throw new Error("Respuesta de guías inválida");
      return Array.from(new Map(responses.flatMap((response) => response.data).map((guide) => [guide.id, guide])).values());
    },
    retry: false,
    staleTime: 60_000,
  });
  const loading = enabled && (query.isPending || (needsScopedOrders && orderQuery.loading));
  const error = enabled && (query.isError || (needsScopedOrders && orderQuery.error));
  const guides = useMemo(() => {
    if (!enabled || loading || error || !query.data) return EMPTY_GUIDES;
    if (!needsScopedOrders) return query.data;
    const scopedOrderIds = new Set(orderQuery.orders.map((order) => order.id));
    return query.data.filter((guide) =>
      (guide.storeId && storeIds.includes(guide.storeId)) ||
      guide.orderIds?.some((id) => scopedOrderIds.has(id)),
    );
  }, [enabled, loading, error, query.data, needsScopedOrders, orderQuery.orders, storeIds]);
  const refetchGuides = query.refetch;
  const refetchOrders = orderQuery.refetch;
  const refetch = useCallback(async (refetchOptions?: RefetchOptions) => {
    const [result] = await Promise.all([
      refetchGuides(refetchOptions),
      ...(needsScopedOrders ? [refetchOrders(refetchOptions)] : []),
    ]);
    return result;
  }, [refetchGuides, refetchOrders, needsScopedOrders]);
  const retry = useCallback(() => refetch(), [refetch]);
  return { guides, loading, error, retry, refetch };
}

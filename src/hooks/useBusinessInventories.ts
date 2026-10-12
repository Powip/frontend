"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchScopeInventories, type BusinessInventory } from "@/services/inventoryCatalogService";

const EMPTY_INVENTORIES: BusinessInventory[] = [];

/** Destination selectors use the complete company catalog; readers may request a store scope. */
export function useBusinessInventories(options?: { scope?: "business" | "store"; storeIds?: string[] }) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const userId = auth?.user?.id ?? "";
  const accessToken = auth?.accessToken ?? "";
  const scope = options?.scope ?? "business";
  const storeIds = [...new Set(options?.storeIds ?? [])].sort();
  const enabled = Boolean(companyId && userId && accessToken && (scope === "business" || storeIds.length === 1));
  const query = useQuery({
    queryKey: ["business-inventories", companyId, userId, scope, storeIds],
    queryFn: ({ signal }) => fetchScopeInventories({ companyId, accessToken, scope, storeIds, signal }),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
  return { ...query, inventories: query.data ?? EMPTY_INVENTORIES, loading: enabled && query.isPending, isPending: enabled && query.isPending, refetch: query.refetch, retry: query.refetch };
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import { getSalesByStores } from "../services/sales.service";

export function useBusinessSales() {
  const { storeIds, canFetch, scopeKey } = useBusinessScope();
  return useQuery({
    queryKey: ["business-sales", scopeKey],
    queryFn: ({ signal }) => getSalesByStores(storeIds, signal),
    enabled: canFetch,
    retry: false,
  });
}

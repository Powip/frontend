import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getBusinessSalesPage, type BusinessSalesQuery } from "@/services/businessSalesService";

export function useBusinessSalesPage(storeIds: readonly string[], query: BusinessSalesQuery) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const userId = auth?.user?.id;
  const ids = [...new Set(storeIds)].sort();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(query.search ?? "");
  const isDebouncing = search !== (query.search ?? "");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.search ?? ""), 350);
    return () => clearTimeout(timer);
  }, [query.search]);
  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ companyId?: string }>).detail?.companyId === companyId) {
        void queryClient.invalidateQueries({ queryKey: ["business-sales", "page", companyId] });
      }
    };
    window.addEventListener("commercial-leads:changed", changed);
    return () => window.removeEventListener("commercial-leads:changed", changed);
  }, [companyId, queryClient]);
  const filters = { ...query, search };
  const result = useQuery({
    queryKey: ["business-sales", "page", companyId, userId, ids, filters],
    queryFn: ({ signal }) => getBusinessSalesPage(ids, filters, signal),
    enabled: !!companyId && !!userId && ids.length > 0 && !isDebouncing,
    staleTime: 30_000,
    retry: false,
  });
  return { ...result, data: isDebouncing ? undefined : result.data, isDebouncing };
}

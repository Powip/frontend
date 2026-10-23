import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPedidosCC, PedidosCcFilters, PaginatedCcResult } from "@/services/atencionClienteService";

export function useCcPedidos(filters: PedidosCcFilters) {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const companyId = auth?.company?.id;
  useEffect(() => {
    const changed = (event: Event) => {
      if (!companyId || (event as CustomEvent<{companyId?: string}>).detail?.companyId !== companyId) return;
      void queryClient.invalidateQueries({ queryKey: ["cc-pedidos"] });
      void queryClient.invalidateQueries({ queryKey: ["cc-kpis"] });
    };
    window.addEventListener("commercial-leads:changed", changed);
    return () => window.removeEventListener("commercial-leads:changed", changed);
  }, [companyId, queryClient]);
  const searchInput = (filters.search ?? "").trim().slice(0, 200);
  const [search, setSearch] = useState(searchInput);
  const isDebouncing = search !== searchInput;
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const requestFilters = { ...filters, search: search || undefined, page: filters.page ?? 1, limit: filters.limit ?? 50 };
  const result = useQuery<PaginatedCcResult>({
    queryKey: ["cc-pedidos", auth?.company?.id, auth?.user?.id, requestFilters],
    queryFn: ({ signal }) => getPedidosCC(requestFilters, signal),
    enabled: !!auth?.accessToken && (!!filters.storeId || !!filters.storeIds?.length) && !isDebouncing,
    retry: false,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  return { ...result, data: isDebouncing ? undefined : result.data, isLoading: result.isLoading || isDebouncing, isDebouncing };
}

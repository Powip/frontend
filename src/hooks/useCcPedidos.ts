import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getPedidosCC, getAllPedidosCC, PedidosCcFilters, PaginatedCcResult } from "@/services/atencionClienteService";

export function useCcPedidos(filters: PedidosCcFilters) {
  const { auth } = useAuth();
  const business = !!filters.storeIds;
  const { page = 1, limit = 50, ...allFilters } = filters;
  return useQuery<PaginatedCcResult>({
    queryKey: ["cc-pedidos", auth?.company?.id, auth?.user?.id, business ? allFilters : filters],
    queryFn: async ({ signal }) => {
      if (!business) return getPedidosCC(filters, signal);
      const result = await getAllPedidosCC(allFilters, signal);
      if (result.truncated) throw new Error("No se pudieron cargar todos los pedidos del negocio");
      return { data: result.data, total: result.total, page: 1, totalPages: Math.max(1, Math.ceil(result.total / limit)) };
    },
    select: business ? (result) => ({ ...result, data: result.data.slice((page - 1) * limit, page * limit), page, totalPages: Math.max(1, Math.ceil(result.total / limit)) }) : undefined,
    enabled: !!auth?.accessToken && (!!filters.storeId || !!filters.storeIds?.length),
    retry: false,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

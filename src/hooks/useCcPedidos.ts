import { useQuery } from "@tanstack/react-query";
import { getPedidosCC, PedidosCcFilters, PaginatedCcResult } from "@/services/atencionClienteService";

export function useCcPedidos(filters: PedidosCcFilters) {
  return useQuery<PaginatedCcResult>({
    queryKey: ["cc-pedidos", filters],
    queryFn: () => getPedidosCC(filters),
    enabled: !!filters.storeId,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getAllPedidosCC, type PedidosCcFilters, type AllPedidosCcResult } from "@/services/atencionClienteService";

/**
 * Todos los pedidos de la pestaña (sin paginar), para el buscador de Gestión COD.
 *
 * - Cacheado por pestaña + filtros (el texto buscado se filtra en cliente y NO
 *   forma parte de la key: escribir no dispara descargas).
 * - Sin polling: descargar todas las páginas cada 30 s es caro. Usa el staleTime
 *   global (QueryProvider) y se refresca explícitamente tras gestionar un pedido.
 * - Sin placeholderData: al cambiar filtros no se muestran resultados de la key
 *   anterior; el `signal` cancela la descarga en curso de la key abandonada.
 */
export function useCcPedidosAll(
  filters: Omit<PedidosCcFilters, "page" | "limit">,
  enabled: boolean,
) {
  const { auth } = useAuth();
  return useQuery<AllPedidosCcResult>({
    queryKey: ["cc-pedidos-all", auth?.company?.id, auth?.user?.id, filters],
    queryFn: ({ signal }) => getAllPedidosCC(filters, signal),
    retry: false,
    enabled: enabled && !!auth?.accessToken && (!!filters.storeId || !!filters.storeIds?.length),
  });
}

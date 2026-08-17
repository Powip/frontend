import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { getPedidosCC } from "@/services/atencionClienteService";
import { OrderHeader } from "@/interfaces/IOrder";

const PAGE_LIMIT = 100;

/**
 * Trae TODOS los pedidos con subEstadoCc="confirmado" (gestión COD) del
 * período — solo esos cuentan como "venta" para el dashboard, a diferencia
 * de /stats/summary (ms-ventas) que suma cualquier pedido sin importar si
 * ya fue confirmado por Call Center o sigue pendiente.
 * Pide la página 1 para conocer el total y dispara el resto en paralelo.
 */
async function fetchAllConfirmedPedidos(
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<OrderHeader[]> {
  const baseFilters = {
    storeId,
    tipoGestion: "cod" as const,
    subEstado: "confirmado" as const,
    startDate,
    endDate,
    limit: PAGE_LIMIT,
  };

  const first = await getPedidosCC({ ...baseFilters, page: 1 });
  const pedidos = [...first.data];

  if (first.totalPages > 1) {
    const remainingPages = Array.from({ length: first.totalPages - 1 }, (_, i) => i + 2);
    const results = await Promise.all(remainingPages.map((page) => getPedidosCC({ ...baseFilters, page })));
    results.forEach((res) => pedidos.push(...res.data));
  }

  return pedidos;
}

export function useCcConfirmedSales(storeId: string | null | undefined, range: DateRange | undefined) {
  const startDate = range?.from?.toISOString();
  const endDate = range?.to?.toISOString();

  return useQuery({
    queryKey: ["cc-confirmed-sales", storeId, startDate, endDate],
    queryFn: () => fetchAllConfirmedPedidos(storeId!, startDate!, endDate!),
    enabled: !!storeId && !!startDate && !!endDate,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

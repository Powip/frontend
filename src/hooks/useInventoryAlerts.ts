"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getInventoryAlerts } from "@/services/inventoryReportsService";

/** Ítems por alerta: el menú, el contador de la pestaña y la lista comparten esta consulta (y su caché). */
export const ALERTS_LIMIT = 20;

/**
 * FEAT-24 H10-D8 — alertas de inventario de la empresa (`GET /inventory-reports/alerts`). Las usan la pestaña
 * Alertas, su contador y el badge del menú «Inventario». Se refrescan cada 5 minutos.
 */
export function useInventoryAlerts(options: { enabled?: boolean } = {}) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const userId = auth?.user?.id ?? "";
  return useQuery({
    queryKey: ["inventory-alerts", companyId, userId, ALERTS_LIMIT],
    queryFn: ({ signal }) => getInventoryAlerts(ALERTS_LIMIT, signal),
    enabled: Boolean(companyId && userId && auth?.accessToken) && options.enabled !== false,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
  });
}

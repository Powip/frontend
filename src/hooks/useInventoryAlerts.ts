"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getInventoryAlerts } from "@/services/inventoryReportsService";

/** Ítems por alerta: el menú, el contador de la pestaña y la lista comparten esta consulta (y su caché). */
export const ALERTS_LIMIT = 20;

/** Raíz de la caché de las alertas (badge del menú, contador de la pestaña y lista). */
export const INVENTORY_ALERTS_KEY = "inventory-alerts";

/**
 * Después de mover stock (despachar o recibir un traslado, aprobar, rechazar o anular un ajuste, aplicar
 * un conteo) el badge de Alertas se recalcula en el momento, sin esperar los 5 minutos del refresco.
 */
export function invalidateInventoryAlerts(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: [INVENTORY_ALERTS_KEY] });
}

/**
 * FEAT-24 H10-D8 — alertas de inventario de la empresa (`GET /inventory-reports/alerts`). Las usan la pestaña
 * Alertas, su contador y el badge del menú «Inventario». Se refrescan cada 5 minutos.
 */
export function useInventoryAlerts(options: { enabled?: boolean } = {}) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const userId = auth?.user?.id ?? "";
  return useQuery({
    queryKey: [INVENTORY_ALERTS_KEY, companyId, userId, ALERTS_LIMIT],
    queryFn: ({ signal }) => getInventoryAlerts(ALERTS_LIMIT, signal),
    enabled: Boolean(companyId && userId && auth?.accessToken) && options.enabled !== false,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
  });
}

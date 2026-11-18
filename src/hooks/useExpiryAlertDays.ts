"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_EXPIRY_ALERT_DAYS } from "@/lib/lots";
import { getInventoryRules } from "@/services/warehousesService";

/**
 * FEAT-24 H5-L — días de aviso de «lotes por vencer» de la empresa (reglas de inventario, `expiryAlertDays`). Misma
 * caché que la sección de reglas; si no se pueden leer, 30.
 */
export function useExpiryAlertDays(): number {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const query = useQuery({
    queryKey: ["inventory-rules", companyId],
    queryFn: () => getInventoryRules(),
    enabled: Boolean(companyId && auth?.accessToken),
    retry: false,
    staleTime: 5 * 60_000,
  });
  return query.data?.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS;
}

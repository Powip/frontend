"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getInventoryRules, type StockControlMode } from "@/services/warehousesService";

/**
 * FEAT-24 C-D3 — control de stock de la empresa (reglas de inventario, `stockControl`). Misma caché que la sección de
 * reglas. Mientras carga o si no se puede leer, `estricto`: el comportamiento de antes (no se ofrece dejar el físico
 * en negativo; si el servidor pide confirmación, igual se muestra).
 */
export function useStockControl(): StockControlMode {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const query = useQuery({
    queryKey: ["inventory-rules", companyId],
    queryFn: () => getInventoryRules(),
    enabled: Boolean(companyId && auth?.accessToken),
    retry: false,
    staleTime: 5 * 60_000,
  });
  return query.data?.stockControl === "flexible" ? "flexible" : "estricto";
}

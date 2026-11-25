"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getInventoryRules, type StockControlMode } from "@/services/warehousesService";

/**
 * FEAT-24 C-D3 — control de stock de la empresa (reglas de inventario, `stockControl`). Misma caché que la sección de
 * reglas. Mientras carga o si no se puede leer, `null` (no se sabe): la pantalla no bloquea ni pide confirmación por
 * adelantado y decide el servidor (en flexible responde 409 `STOCK_NEGATIVO_CONFIRMAR` y ahí se muestra la casilla; en
 * estricto, su error de siempre). Así una empresa flexible no queda frenada porque falló la lectura de las reglas.
 */
export function useStockControl(): StockControlMode | null {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const query = useQuery({
    queryKey: ["inventory-rules", companyId],
    queryFn: () => getInventoryRules(),
    enabled: Boolean(companyId && auth?.accessToken),
    retry: false,
    staleTime: 5 * 60_000,
  });
  const mode = query.data?.stockControl;
  return mode === "flexible" || mode === "estricto" ? mode : null;
}

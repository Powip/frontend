"use client";

import { useQuery } from "@tanstack/react-query";
import {
  VariantStock,
  getStockByVariants,
} from "@/services/inventoryItems.service";

/**
 * FEAT-17 Anexo B — stock/reservas agregados de un conjunto de variantes
 * (candidatas de un cluster + hermanas de sus productos), para la vista
 * previa del merge en `ReconciliationMergeDialog`. `enabled` corta mientras
 * todavía no hay ids que pedir (p.ej. mientras el detalle de la tarea sigue
 * cargando). La query key ordena los ids para no disparar un refetch
 * innecesario cuando el mismo conjunto llega en otro orden.
 */
export function useReconciliationStockByVariants(variantIds: string[]) {
  const sortedIds = [...variantIds].sort();

  return useQuery<VariantStock[], Error>({
    queryKey: ["reconciliation-stock-by-variants", sortedIds],
    queryFn: () => getStockByVariants(variantIds),
    enabled: variantIds.length > 0,
    staleTime: 30 * 1000,
    retry: false,
  });
}

"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { listWarehouses, type CompanyWarehouse } from "@/services/warehousesService";

/** Texto cuando un almacén no tiene nombre conocido (no está en la lista de la empresa). */
export const UNKNOWN_WAREHOUSE_NAME = "Almacén";

/** Nombre de un almacén por id: sin id, «—»; si no está en la lista, «Almacén». */
export function warehouseNameOf(warehouses: readonly Pick<CompanyWarehouse, "id" | "name">[], inventoryId: string | null | undefined): string {
  if (!inventoryId) return "—";
  return warehouses.find((warehouse) => warehouse.id === inventoryId)?.name || UNKNOWN_WAREHOUSE_NAME;
}

/**
 * Almacenes de la empresa (`GET /warehouses` de la fachada, JWT), con la caché `company-warehouses` que
 * comparten Stock, Recepciones, Compras, los reportes de H10 y las operaciones de almacén de H5. Es el
 * único hook para esto (FEAT-24 H5/H10).
 */
export function useCompanyWarehouses() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const query = useQuery({
    queryKey: ["company-warehouses", companyId],
    queryFn: () => listWarehouses(),
    enabled: Boolean(companyId && auth?.accessToken),
    retry: false,
    staleTime: 60_000,
  });
  const warehouses = useMemo<CompanyWarehouse[]>(() => query.data?.warehouses ?? [], [query.data]);
  const nameOf = useCallback((inventoryId: string | null | undefined) => warehouseNameOf(warehouses, inventoryId), [warehouses]);
  return { query, warehouses, nameOf, isLoading: query.isPending && query.fetchStatus !== "idle", error: query.error };
}

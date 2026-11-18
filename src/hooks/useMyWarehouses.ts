"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  canOperateWarehouse,
  canSeeWarehouse,
  filterOperableWarehouses,
  filterVisibleWarehouses,
  toWarehouseScope,
  type WarehouseScope,
} from "@/lib/warehouseScope";
import { getMyWarehouses } from "@/services/userWarehousesService";

// FEAT-24 H6 — almacenes del usuario (`GET /me/warehouses`), cacheados por
// empresa y usuario. Si la consulta falla (por ejemplo, la fachada todavía no
// está desplegada) no se filtra nada: el backend igual valida.

export const MY_WAREHOUSES_KEY = "me-warehouses";

export interface MyWarehousesValue extends WarehouseScope {
  isLoading: boolean;
  canSee(inventoryId: string): boolean;
  canOperate(inventoryId: string): boolean;
  visible<T extends { id: string }>(list: readonly T[]): T[];
  operable<T extends { id: string }>(list: readonly T[]): T[];
}

export function useMyWarehouses(): MyWarehousesValue {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? null;
  const userId = auth?.user?.id ?? null;
  const enabled = Boolean(companyId && userId && auth?.accessToken);
  const query = useQuery({
    queryKey: [MY_WAREHOUSES_KEY, companyId, userId],
    queryFn: ({ signal }) => getMyWarehouses(signal),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const scope = useMemo(() => toWarehouseScope(query.data), [query.data]);
  return useMemo(
    () => ({
      ...scope,
      isLoading: enabled && query.isPending,
      canSee: (inventoryId: string) => canSeeWarehouse(scope, inventoryId),
      canOperate: (inventoryId: string) => canOperateWarehouse(scope, inventoryId),
      visible: <T extends { id: string }>(list: readonly T[]) => filterVisibleWarehouses(scope, list),
      operable: <T extends { id: string }>(list: readonly T[]) => filterOperableWarehouses(scope, list),
    }),
    [scope, enabled, query.isPending],
  );
}

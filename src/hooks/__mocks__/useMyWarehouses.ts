// Mock manual de useMyWarehouses para los tests (`jest.mock("@/hooks/useMyWarehouses")`):
// no necesita AuthProvider ni red. Por defecto no filtra nada (como cuando el
// usuario no tiene asignaciones); `__setMyWarehouses` fija el alcance.

import {
  canOperateWarehouse,
  canSeeWarehouse,
  filterOperableWarehouses,
  filterVisibleWarehouses,
  toWarehouseScope,
  UNKNOWN_SCOPE,
  type WarehouseScope,
} from "@/lib/warehouseScope";
import type { MyWarehouses } from "@/services/userWarehousesService";
import type { MyWarehousesValue } from "../useMyWarehouses";

export const MY_WAREHOUSES_KEY = "me-warehouses";

const valueOf = (scope: WarehouseScope): MyWarehousesValue => ({
  ...scope,
  isLoading: false,
  canSee: (inventoryId: string) => canSeeWarehouse(scope, inventoryId),
  canOperate: (inventoryId: string) => canOperateWarehouse(scope, inventoryId),
  visible: <T extends { id: string }>(list: readonly T[]) => filterVisibleWarehouses(scope, list),
  operable: <T extends { id: string }>(list: readonly T[]) => filterOperableWarehouses(scope, list),
});

let current = valueOf(UNKNOWN_SCOPE);

export function __setMyWarehouses(data: MyWarehouses | null): void {
  current = valueOf(data ? toWarehouseScope(data) : UNKNOWN_SCOPE);
}

export function useMyWarehouses(): MyWarehousesValue {
  return current;
}

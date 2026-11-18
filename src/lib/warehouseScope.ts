import type { MyWarehouses } from "@/services/userWarehousesService";

// FEAT-24 H6 (H6-D5) — filtro global de almacenes por usuario. Funciones puras
// que usan `useMyWarehouses` y los selectores de almacén: sin asignaciones (o
// mientras no se sabe) se muestran todos; con asignaciones, solo los que el
// usuario ve, y donde mueve stock, solo los que opera. El backend igual valida
// (403 «No tienes acceso a este almacén.»): esto solo evita ofrecer lo que va a
// fallar.

export interface WarehouseScope {
  /** `false` mientras no llegó la respuesta (o falló): no se filtra nada. */
  known: boolean;
  /** Sin asignaciones: ve y opera todos. */
  all: boolean;
  visibleIds: ReadonlySet<string>;
  operableIds: ReadonlySet<string>;
}

export const UNKNOWN_SCOPE: WarehouseScope = { known: false, all: true, visibleIds: new Set(), operableIds: new Set() };

export function toWarehouseScope(data: MyWarehouses | null | undefined): WarehouseScope {
  if (!data) return UNKNOWN_SCOPE;
  return {
    known: true,
    all: data.all,
    visibleIds: new Set(data.inventoryIds),
    operableIds: new Set(data.operableIds),
  };
}

const unrestricted = (scope: WarehouseScope) => !scope.known || scope.all;

export const canSeeWarehouse = (scope: WarehouseScope, inventoryId: string): boolean =>
  unrestricted(scope) || scope.visibleIds.has(inventoryId);

export const canOperateWarehouse = (scope: WarehouseScope, inventoryId: string): boolean =>
  unrestricted(scope) || scope.operableIds.has(inventoryId);

/** Los almacenes de la lista que el usuario ve (todos si no tiene asignaciones). */
export function filterVisibleWarehouses<T extends { id: string }>(scope: WarehouseScope, list: readonly T[]): T[] {
  return unrestricted(scope) ? [...list] : list.filter((warehouse) => scope.visibleIds.has(warehouse.id));
}

/** Los almacenes de la lista donde el usuario puede mover stock. */
export function filterOperableWarehouses<T extends { id: string }>(scope: WarehouseScope, list: readonly T[]): T[] {
  return unrestricted(scope) ? [...list] : list.filter((warehouse) => scope.operableIds.has(warehouse.id));
}

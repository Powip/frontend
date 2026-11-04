import { emptySalesFilters, type SalesFilters } from "@/components/ventas/SalesTableFilters";
import type {
  OperationsPedidosQuery,
  OperationsCounts,
  OperationsGuideGroup,
  OperationsPedidosPage,
  OperationsQuickFilter,
  OperationsWindow,
} from "@/services/operationsPedidosService";
import type { PedidosActions, Sale } from "./types";

/** Lo que el usuario eligió en una pestaña (filtros, página…): con esto se pide la página al servidor. */
export interface TabQueryState {
  filters: SalesFilters;
  page: number;
  /** Preparados: Contactados (LLAMADO) / No contactados (PREPARADO). */
  sub?: "contactado" | "no_contactado";
  view: "pedido" | "guia";
  /** "Cualquier antigüedad" = sin valor. */
  minAgeDays?: 7 | 15;
  quick?: OperationsQuickFilter;
}

export const emptyTabState = (): TabQueryState => ({ filters: { ...emptySalesFilters }, page: 1, view: "pedido" });

/** Cambiar cualquier cosa que no sea la página vuelve a la página 1. */
export function patchTabState(state: TabQueryState, patch: Partial<TabQueryState>): TabQueryState {
  const next = { ...state, ...patch };
  const pageOnly = Object.keys(patch).every((key) => key === "page");
  return pageOnly ? next : { ...next, page: patch.page ?? 1 };
}

/** Datos de la pestaña activa, ya mapeados a filas (`Sale`). */
export interface OperationsTabData {
  sales: Sale[];
  groups?: OperationsGuideGroup[];
  /** Pedidos (o guías en la vista por guía) que cumplen el filtro actual. */
  total: number;
  totalOrders?: number;
  totalPages: number;
  counts?: OperationsCounts;
  window?: OperationsWindow;
  metadata?: OperationsPedidosPage["metadata"];
  /** Primera carga de la pestaña. */
  loading: boolean;
  /** Llega otra página; se siguen mostrando las filas anteriores. */
  fetching: boolean;
}

export interface OperationsTabProps {
  data: OperationsTabData;
  state: TabQueryState;
  /** La consulta que se le pidió al servidor (pestaña + filtros): sirve para saber qué de la selección sigue visible. */
  query: OperationsPedidosQuery;
  onState: (patch: Partial<TabQueryState>) => void;
  actions: PedidosActions;
}

import axiosAuth from "@/lib/axiosAuth";
import type { OrderHeader } from "@/interfaces/IOrder";
import type { SalesFilters } from "@/components/ventas/SalesTableFilters";

/**
 * Pestañas de /operaciones/pedidos tal como las nombra el backend
 * (`GET /order-header/business/operations`). La pestaña "camino" de la UI es "en-camino" aquí.
 */
export type OperationsServerTab =
  | "preparados"
  | "en-camino"
  | "despachados"
  | "entregados"
  | "anulados"
  | "historial"
  | "atencion";

export interface OperationsCounts {
  preparados: number;
  preparadosContactados: number;
  preparadosNoContactados: number;
  enCamino: number;
  despachados: number;
  entregados: number;
  anulados: number;
  historial: number;
  atencion: number;
}

export interface OperationsGuideGroup {
  /** Vacío = pedidos sin guía. */
  guideNumber: string;
  courier: string | null;
  orders: number;
  orderIds: string[];
  orderNumbers: string[];
  /** Estados distintos de los pedidos de la guía (p. ej. ASIGNADO_A_GUIA y EN_ENVIO). */
  statuses: string[];
  zones: string[];
  pending: number;
  departedAt: string | null;
  hasIncidents: boolean;
  allDeliveredByCourier: boolean;
}

export interface OperationsWindow {
  days: number;
  from: string | null;
  to: string | null;
  /** true cuando el rango viene de los filtros del usuario; false = ventana por defecto. */
  explicit: boolean;
}

/** Cada fila trae además la fecha en que el pedido llegó a su estado actual. */
export type OperationsOrder = OrderHeader & { statusChangedAt?: string | null };

export interface OperationsPedidosPage {
  data: OperationsOrder[];
  groups?: OperationsGuideGroup[];
  /** Pedidos (vista por pedido) o guías (vista por guía) que cumplen el filtro. */
  total: number;
  /** Solo en la vista por guía: pedidos que cumplen el filtro. */
  totalOrders?: number;
  page: number;
  totalPages: number;
  counts?: OperationsCounts;
  window: OperationsWindow;
  metadata?: { couriers: string[]; channels: string[]; products: { value: string; label: string }[] };
}

export type OperationsQuickFilter = "agencia-por-vencer" | "por-confirmar";

export interface OperationsPedidosQuery {
  tab: OperationsServerTab;
  /** Solo en Preparados: contactado = LLAMADO, no_contactado = PREPARADO. */
  sub?: "contactado" | "no_contactado";
  view?: "pedido" | "guia";
  minAgeDays?: 7 | 15;
  quick?: OperationsQuickFilter;
  /** Solo estos pedidos (máx. 100), siempre que cumplan la pestaña y los filtros. */
  ids?: string[];
  page: number;
  limit: number;
  filters: Partial<SalesFilters>;
  /** false en las páginas de exportación: no calcula contadores ni metadatos. */
  includeSummary?: boolean;
}

export const OPERATIONS_PAGE_SIZE = 15;
export const OPERATIONS_MAX_PAGE_SIZE = 100;

const FILTER_KEYS = [
  "dateFrom", "dateTo", "search", "paymentMethod", "hasPendingBalance", "region", "deliveryType",
  "courier", "zone", "hasGuide", "source", "status", "salesChannel", "product",
] as const satisfies readonly (keyof SalesFilters)[];

export function buildOperationsPedidosParams(storeIds: readonly string[], query: OperationsPedidosQuery): URLSearchParams {
  const ids = [...new Set(storeIds)].sort();
  if (!ids.length || ids.length > 200 || ids.some((id) => !id.trim())) {
    throw new Error("Selecciona tiendas válidas del negocio.");
  }
  if (!Number.isInteger(query.page) || query.page < 1 || !Number.isInteger(query.limit) || query.limit < 1 || query.limit > OPERATIONS_MAX_PAGE_SIZE) {
    throw new Error("La página solicitada no es válida.");
  }
  const params = new URLSearchParams({ storeIds: ids.join(","), tab: query.tab, page: String(query.page), limit: String(query.limit) });
  for (const key of ["sub", "view", "minAgeDays", "quick"] as const) {
    const value = query[key];
    if (value !== undefined) params.set(key, String(value));
  }
  if (query.ids?.length) params.set("ids", query.ids.join(","));
  if (query.includeSummary === false) params.set("includeSummary", "false");
  for (const key of FILTER_KEYS) {
    const value = query.filters[key];
    if (value !== undefined && value !== "") params.set(key, String(value).trim());
  }
  return params;
}

export async function getOperationsPedidosPage(
  storeIds: readonly string[],
  query: OperationsPedidosQuery,
  signal?: AbortSignal,
): Promise<OperationsPedidosPage> {
  const params = buildOperationsPedidosParams(storeIds, query);
  return (
    await axiosAuth.get<OperationsPedidosPage>(
      `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/business/operations?${params}`,
      { signal },
    )
  ).data;
}

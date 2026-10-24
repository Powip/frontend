import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { isTracked, type TrackingMode } from "./inventoryTrackingService";
import { canPrepareDeferredManualOrder, type SalesPhysicalOrderProjection } from "@/utils/commercialOrders";

export type UnitAssignmentStatus =
  | "NONE"
  | "UNKNOWN"
  | "PENDING_SELECTION"
  | "PENDING"
  | "CONFIRMED"
  | "REJECTED";
export interface UnitAssignmentState {
  unitAssignmentStatus?: UnitAssignmentStatus;
  unitCatalogValidated?: boolean;
  unitStockState?: "reserved" | "committed" | "released" | null;
  hasTrackedUnits?: boolean;
  items?: { trackingMode?: string }[];
  confirmedStockVersion?: number | null;
  stockVersion?: number;
  unitAssignmentError?: string | null;
}
export const assignmentLabels: Record<UnitAssignmentStatus, string> = {
  NONE: "Sin seguimiento por unidad",
  UNKNOWN: "Seguimiento por comprobar",
  PENDING_SELECTION: "Falta seleccionar IMEI/series",
  PENDING: "Solicitud de reserva pendiente de confirmación",
  CONFIRMED: "Unidades confirmadas",
  REJECTED: "No se pudieron reservar las unidades",
};

/** A quantity hold is acknowledged stock, but never permission to fulfill without unit IDs. */
export function hasConfirmedQuantityHold(order: UnitAssignmentState): boolean {
  return order.unitAssignmentStatus === "PENDING_SELECTION" &&
    order.unitCatalogValidated === true &&
    order.unitStockState === "reserved" &&
    Number.isSafeInteger(order.stockVersion) &&
    (order.stockVersion ?? 0) >= 1 &&
    order.confirmedStockVersion === order.stockVersion;
}

export function unitAssignmentLabel(order: UnitAssignmentState): string | null {
  const state = order.unitAssignmentStatus;
  if (!state || !hasUnitAssignment(order)) return null;
  if (hasConfirmedQuantityHold(order)) return "Stock reservado · falta asignar IMEI/serie";
  if (state === "PENDING_SELECTION") return "Stock sin reserva confirmada · falta asignar IMEI/serie";
  if (state === "CONFIRMED" &&
    (!Number.isSafeInteger(order.stockVersion) || order.confirmedStockVersion !== order.stockVersion))
    return assignmentLabels.PENDING;
  return assignmentLabels[state];
}

export function validateSaleUnits(
  lines: {
    trackingMode?: TrackingMode | "UNKNOWN";
    unitIds?: string[];
    quantity: number;
    sku?: string;
  }[],
): string | null {
  const used = new Set<string>();
  for (const line of lines) {
    if (!isTracked(line.trackingMode)) continue;
    if (
      !Number.isSafeInteger(line.quantity) ||
      line.quantity <= 0 ||
      (line.unitIds?.length ?? 0) !== line.quantity
    ) {
      return `${line.sku || "Producto"}: selecciona exactamente ${line.quantity} IMEI/series, uno por unidad.`;
    }
    for (const id of line.unitIds ?? []) {
      if (!id || used.has(id.toLowerCase()))
        return "Una unidad está seleccionada más de una vez. Revisa todas las líneas, incluidos packs y regalos.";
      used.add(id.toLowerCase());
    }
  }
  return null;
}

const fulfillmentStatuses = new Set([
  "PREPARADO",
  "LLAMADO",
  "ASIGNADO_A_GUIA",
  "EN_ENVIO",
  "ENTREGADO",
]);
export function hasUnitAssignment(order: UnitAssignmentState): boolean {
  const state = order.unitAssignmentStatus;
  if (!state || state === "NONE" || state === "UNKNOWN") return false;
  return (
    state !== "PENDING_SELECTION" ||
    order.unitCatalogValidated !== false ||
    Boolean(order.hasTrackedUnits) ||
    Boolean(order.items?.some((item) => isTracked(item.trackingMode)))
  );
}
export function requiresAuthenticatedSaleMutation(order?: UnitAssignmentState | null): boolean {
  return Boolean(
    order?.hasTrackedUnits ||
    (order?.unitAssignmentStatus && order.unitAssignmentStatus !== "NONE") ||
    order?.items?.some((item) => isTracked(item.trackingMode) || item.trackingMode === "UNKNOWN"),
  );
}
export function requiresAuthenticatedSaleStatusMutation(order?: (UnitAssignmentState & SalesPhysicalOrderProjection) | null): boolean {
  return requiresAuthenticatedSaleMutation(order) || Boolean(order && canPrepareDeferredManualOrder(order));
}
export function saleMutationUrl(apiBase: string, orderId: string, order?: (UnitAssignmentState & SalesPhysicalOrderProjection) | null): string {
  return requiresAuthenticatedSaleStatusMutation(order)
    ? `${apiBase}/order-header/manual/${orderId}/status`
    : `${apiBase}/order-header/${orderId}`;
}
export function saleReceiptUrl(apiBase: string, orderId: string, order?: UnitAssignmentState | null): string {
  return requiresAuthenticatedSaleMutation(order)
    ? `${apiBase}/order-header/manual/${orderId}/receipt`
    : `${apiBase}/order-header/${orderId}/receipt`;
}
export function assignmentBlockReason(
  order: UnitAssignmentState,
  targetStatus?: string,
): string | null {
  if (targetStatus !== undefined && !fulfillmentStatuses.has(targetStatus)) return null;
  const state = order.unitAssignmentStatus;
  if (!hasUnitAssignment(order) || !state) return null;
  if (
    state === "CONFIRMED" &&
    Number.isSafeInteger(order.stockVersion) &&
    order.confirmedStockVersion === order.stockVersion
  )
    return null;
  const label =
    state === "CONFIRMED"
      ? "La nueva selección de unidades está pendiente de confirmación"
      : unitAssignmentLabel(order);
  return `${label}. Abre la venta para revisar la selección y confirmar la reserva antes de preparar o entregar.`;
}

const API = `${GATEWAY.ventas}/order-header/manual`;
export const getSaleAssignment = async <T>(orderId: string, signal?: AbortSignal) =>
  (await axiosAuth.get<T>(`${API}/${orderId}`, { signal })).data;
export const retrySaleAssignment = async <T>(orderId: string) =>
  (await axiosAuth.post<T>(`${API}/${orderId}/unit-stock/retry`)).data;
export const getSaleOperation = async <T>(operationId: string) =>
  (await axiosAuth.get<T>(`${API}/operations/${operationId}`)).data;

export interface PendingSaleOperation {
  operationId: string;
  orderId?: string;
  definitiveRejection?: boolean;
  method: "post" | "put";
  url: string;
  payload: Record<string, unknown>;
}
export const saleOperationKey = (companyId: string, userId: string, orderId?: string | null) =>
  `powip:tracked-sale:v1:${companyId}:${userId}:${orderId || "new"}`;
export function readSaleOperation(key: string): PendingSaleOperation | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null") as PendingSaleOperation | null;
    return value?.operationId &&
      value.payload?.operationId === value.operationId &&
      (value.method === "post" || value.method === "put") &&
      (value.url === API || value.url.startsWith(`${API}/`))
      ? value
      : null;
  } catch {
    return null;
  }
}
export function persistSaleOperation(key: string, operation: PendingSaleOperation | null) {
  // Failing to retain the request must stop a new tracked write: its retry identity matters.
  if (operation) sessionStorage.setItem(key, JSON.stringify(operation));
  else {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* The server already committed; retaining the same identity is safe. */
    }
  }
}

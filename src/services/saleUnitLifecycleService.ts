import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { isTracked, type InventoryUnit, type TrackingMode } from "./inventoryTrackingService";
import { requiresAuthenticatedSaleMutation, type UnitAssignmentState } from "./saleTrackingService";
import type { OrderHeader } from "@/interfaces/IOrder";

export type SaleUnitLifecycleAction = "return" | "reactivate";
export interface SaleUnitLifecycleSelection {
  orderItemId: string;
  quantity: number;
  unitIds?: string[];
}
export interface SaleUnitLifecycleDraft {
  reason: string;
  physicalReturnConfirmed?: boolean;
  items: SaleUnitLifecycleSelection[];
}
export interface SaleUnitLifecycleRequest extends SaleUnitLifecycleDraft {
  operationId: string;
  expectedStockVersion: number;
}
export interface SaleUnitLifecycleOperation {
  operationId: string;
  kind: SaleUnitLifecycleAction;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "ABORTED";
  stockVersion: number;
  result?: unknown;
  error?: string | null;
}
export interface SaleUnitLifecycleContext {
  orderId: string;
  status: OrderHeader["status"];
  expectedStockVersion: number;
  inventoryId?: string;
  stockStoreId?: string;
  stockVersion?: number;
  confirmedStockVersion?: number | null;
  unitAssignmentStatus: OrderHeader["unitAssignmentStatus"];
  unitStockState: "reserved" | "committed" | "released" | null;
  canReturn: boolean;
  requiresPhysicalReturnConfirmation: boolean;
  canReactivate: boolean;
  items: {
    orderItemId: string;
    productVariantId: string;
    productName: string;
    sku: string;
    quantity: number;
    trackingMode: TrackingMode | "UNKNOWN";
    unitIds: string[];
    units: InventoryUnit[];
  }[];
  operations: SaleUnitLifecycleOperation[];
}
export type SaleUnitLifecycleResponse = OrderHeader & {
  unitLifecycleOperation: SaleUnitLifecycleOperation;
};
export interface PendingLifecycleOperation {
  orderId: string;
  kind: SaleUnitLifecycleAction;
  operationId: string;
  request?: SaleUnitLifecycleRequest;
  definitiveRejection?: boolean;
}
const API = `${GATEWAY.ventas}/order-header/manual`;
export const getSaleUnitLifecycleContext = async (orderId: string, signal?: AbortSignal) =>
  (
    await axiosAuth.get<SaleUnitLifecycleContext>(`${API}/${orderId}/unit-lifecycle/context`, {
      signal,
    })
  ).data;
export const submitSaleUnitLifecycle = async (
  orderId: string,
  kind: SaleUnitLifecycleAction,
  request: SaleUnitLifecycleRequest,
) =>
  (await axiosAuth.post<SaleUnitLifecycleResponse>(`${API}/${orderId}/unit-stock/${kind}`, request))
    .data;
export const lifecycleStorageKey = (companyId: string, userId: string, orderId: string) =>
  `powip:sale-unit-lifecycle:v1:${companyId}:${userId}:${orderId}`;
export function readLifecycleOperation(
  key: string,
  orderId: string,
): PendingLifecycleOperation | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(key) || "null",
    ) as PendingLifecycleOperation | null;
    if (
      !value ||
      value.orderId !== orderId ||
      !value.operationId ||
      !["return", "reactivate"].includes(value.kind)
    )
      return null;
    if (
      value.request &&
      (value.request.operationId !== value.operationId ||
        !Number.isSafeInteger(value.request.expectedStockVersion) ||
        !Array.isArray(value.request.items))
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
export function persistLifecycleOperation(key: string, value: PendingLifecycleOperation | null) {
  if (value) sessionStorage.setItem(key, JSON.stringify(value));
  else {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* A retained confirmed identity is safe to recover. */
    }
  }
}

export function saleLifecycleTransition(
  order: (UnitAssignmentState & { status: string }) | null | undefined,
  target: string,
): SaleUnitLifecycleAction | null {
  if (!order || !requiresAuthenticatedSaleMutation(order)) return null;
  if (["ENTREGADO", "EN_ENVIO"].includes(order.status) && target === "ANULADO") return "return";
  if (order.status === "ANULADO" && target === "PENDIENTE") return "reactivate";
  return null;
}

export function hasKnownUnitTracking(order: UnitAssignmentState): boolean {
  return Boolean(
    order.hasTrackedUnits ||
      order.items?.some((item) => isTracked(item.trackingMode)) ||
      ["PENDING", "CONFIRMED", "REJECTED"].includes(order.unitAssignmentStatus ?? "") ||
      (order.unitAssignmentStatus === "PENDING_SELECTION" && order.unitCatalogValidated === true),
  );
}

export async function resolveSaleLifecycleTransition(
  order: (UnitAssignmentState & { id: string; status: string }) | null | undefined,
  target: string,
  signal?: AbortSignal,
): Promise<SaleUnitLifecycleAction | null> {
  if (!order) return null;
  const action =
    ["ENTREGADO", "EN_ENVIO"].includes(order.status) && target === "ANULADO"
      ? "return"
      : order.status === "ANULADO" && target === "PENDIENTE"
        ? "reactivate"
        : null;
  if (!action) return null;
  if (hasKnownUnitTracking(order)) return action;
  const unknown =
    order.unitCatalogValidated === false ||
    order.unitAssignmentStatus === "UNKNOWN" ||
    order.unitAssignmentStatus === "PENDING_SELECTION" ||
    order.items?.some((item) => item.trackingMode === "UNKNOWN");
  if (!unknown) return null;
  const context = await getSaleUnitLifecycleContext(order.id, signal);
  if (
    context.orderId !== order.id ||
    context.status !== order.status ||
    !context.items.length ||
    context.items.some((item) => !["NONE", "SERIAL", "IMEI"].includes(item.trackingMode))
  )
    throw new Error(
      "No se pudo validar el seguimiento de esta venta. Actualiza e inténtalo otra vez.",
    );
  return context.items.some((item) => isTracked(item.trackingMode)) ? action : null;
}

import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { InventoryUnit, TrackingMode } from "./inventoryTrackingService";

export type InventoryUnitMovementAction = "transfer" | "write-off";
export const SHRINKAGE_TYPES = {
  devolucion_irrecuperable: "Devolución irrecuperable",
  daño_almacen: "Daño en almacén",
  envio_perdido_courier: "Envío perdido (courier)",
  descuento_forzado: "Descuento forzado",
  diferencia_inventario: "Diferencia de inventario",
  otro: "Otro",
} as const;
export type UnitShrinkageType = keyof typeof SHRINKAGE_TYPES;
export interface InventoryUnitMovementDraft {
  quantity: number;
  unitIds: string[];
  reason: string;
  destinationInventoryId?: string;
  shrinkageType?: UnitShrinkageType;
  unitCost?: number;
  recoveredAmount?: number;
}
export interface InventoryUnitMovementSource {
  inventoryItemId: string;
  variantId: string;
  inventoryId: string;
  inventoryName: string;
  productName: string;
  sku: string;
  attributes?: Record<string, string>;
}
export type InventoryUnitMovementRequest = InventoryUnitMovementDraft & { operationId: string } & (
    | { sourceInventoryItemId: string; destinationInventoryId: string }
    | { inventoryItemId: string; shrinkageType: UnitShrinkageType; unitCost: number }
  );
export interface InventoryUnitMovementReceipt {
  companyId: string;
  operationId: string;
  kind: "TRANSFER" | "WRITE_OFF";
  status: "COMPLETED" | "REJECTED";
  quantity: number;
  unitIds: string[];
  sourceInventoryItemId: string;
  sourceInventoryId?: string;
  destinationInventoryId?: string;
  destinationInventoryItemId?: string;
  units?: InventoryUnit[];
  movementIds?: string[];
  shrinkageId?: string;
  error?: { statusCode: number; message: string };
  alreadyApplied?: boolean;
}
export interface AvailableInventoryUnitsResponse {
  inventoryItemId: string;
  inventoryId: string;
  variantId: string;
  trackingMode: TrackingMode;
  data: InventoryUnit[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
export interface PendingInventoryUnitMovement {
  action: InventoryUnitMovementAction;
  operationId: string;
  request: InventoryUnitMovementRequest;
}
const API = `${process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products}/tracking`;
export const getAvailableInventoryUnits = async (
  inventoryItemId: string,
  page: number,
  q: string,
  signal?: AbortSignal,
) =>
  (
    await axiosAuth.get<AvailableInventoryUnitsResponse>(
      `${API}/items/${inventoryItemId}/available-units`,
      { params: { page, limit: 20, q: q || undefined }, signal },
    )
  ).data;
export const submitInventoryUnitMovement = async (
  action: InventoryUnitMovementAction,
  request: InventoryUnitMovementRequest,
) =>
  (
    await axiosAuth.post<InventoryUnitMovementReceipt>(
      `${API}/${action === "transfer" ? "unit-transfers" : "unit-write-offs"}`,
      request,
    )
  ).data;
export const getInventoryUnitOperation = async (operationId: string) =>
  (await axiosAuth.get<InventoryUnitMovementReceipt>(`${API}/unit-operations/${operationId}`)).data;
export const inventoryUnitMovementKey = (
  companyId: string,
  userId: string,
  inventoryItemId: string,
) => `powip:inventory-unit-movement:v1:${companyId}:${userId}:${inventoryItemId}`;
export function readInventoryUnitMovement(
  key: string,
  sourceId: string,
): PendingInventoryUnitMovement | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(key) || "null",
    ) as PendingInventoryUnitMovement | null;
    if (
      !value ||
      !["transfer", "write-off"].includes(value.action) ||
      !value.operationId ||
      value.operationId !== value.request?.operationId ||
      !Number.isSafeInteger(value.request.quantity) ||
      value.request.quantity < 1 ||
      !Array.isArray(value.request.unitIds) ||
      ("sourceInventoryItemId" in value.request
        ? value.request.sourceInventoryItemId
        : value.request.inventoryItemId) !== sourceId
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
export function saveInventoryUnitMovement(key: string, value: PendingInventoryUnitMovement | null) {
  if (value) sessionStorage.setItem(key, JSON.stringify(value));
  else {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Keeping a confirmed UUID is safe to recover. */
    }
  }
}
const sameIds = (left: string[] | undefined, right: string[]) =>
  Array.isArray(left) &&
  left.every((id) => typeof id === "string") &&
  JSON.stringify(left.map((id) => id.toLowerCase()).sort()) ===
    JSON.stringify(right.map((id) => id.toLowerCase()).sort());
export function validateInventoryMovementReceipt(
  receipt: InventoryUnitMovementReceipt,
  pending: PendingInventoryUnitMovement,
  companyId: string,
  source: InventoryUnitMovementSource,
): void {
  const request = pending.request;
  const kind = pending.action === "transfer" ? "TRANSFER" : "WRITE_OFF";
  if (
    !receipt ||
    receipt.companyId !== companyId ||
    receipt.operationId !== pending.operationId ||
    receipt.kind !== kind ||
    !["COMPLETED", "REJECTED"].includes(receipt.status) ||
    receipt.sourceInventoryItemId !== source.inventoryItemId ||
    receipt.quantity !== request.quantity ||
    !sameIds(receipt.unitIds, request.unitIds) ||
    (pending.action === "transfer" &&
      receipt.destinationInventoryId !== request.destinationInventoryId)
  )
    throw new Error(
      "No se pudo comprobar el resultado de este movimiento. Conservamos la solicitud para consultarla otra vez.",
    );
  if (
    receipt.status === "COMPLETED" &&
    (receipt.sourceInventoryId !== source.inventoryId ||
      !sameIds(
        receipt.units?.map((unit) => unit.id),
        request.unitIds,
      ) ||
      receipt.units?.some(
        (unit) =>
          !unit.code ||
          unit.status !== (pending.action === "transfer" ? "AVAILABLE" : "WRITTEN_OFF"),
      ) ||
      !receipt.movementIds?.length ||
      (pending.action === "write-off" && !receipt.shrinkageId))
  )
    throw new Error(
      "El recibo no confirma todas las unidades del movimiento. Conservamos su identificador.",
    );
}

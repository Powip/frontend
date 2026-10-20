import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { InventoryUnit } from "./inventoryTrackingService";

export interface UnitTraceInventory {
  id: string;
  name: string;
}
export interface InventoryUnitTraceResponse {
  companyId: string;
  product: { id: string; name: string; sku: string; attributes: Record<string, string> } | null;
  unit: {
    id: string;
    code: string;
    trackingMode: "SERIAL" | "IMEI";
    status: InventoryUnit["status"];
    variantId: string;
    inventoryItemId: string;
    locationVersion: number;
    inventory: UnitTraceInventory;
    purchase: { id: string; itemId: string } | null;
    reservedOrderId: string | null;
    soldOrderId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  data: {
    movementId: string;
    type: string;
    quantity: number;
    movementQuantity: number;
    physicalDelta: number;
    reason: string | null;
    referenceId: string | null;
    createdAt: string;
    inventory: UnitTraceInventory;
    transfer?: {
      operationId: string;
      locationVersion?: number;
      sourceInventory: UnitTraceInventory;
      destinationInventory: UnitTraceInventory;
    } | null;
  }[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}
const API = `${process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products}/tracking`;
export const trimUnitTraceCode = (code: string) => code.replace(/^ +| +$/g, "");
export const normalizeUnitTraceCode = (code: string) => trimUnitTraceCode(code).toUpperCase();
export const validUnitTraceCode = (code: string) => {
  const normalized = normalizeUnitTraceCode(code);
  return normalized.length >= 1 && normalized.length <= 100 && !/[^A-Z0-9._/-]/.test(normalized);
};
export const getInventoryUnitTrace = async (
  code: string,
  page = 1,
  signal?: AbortSignal,
): Promise<InventoryUnitTraceResponse> =>
  (
    await axiosAuth.get<InventoryUnitTraceResponse>(`${API}/unit-trace`, {
      params: { code: trimUnitTraceCode(code), page, limit: 20 },
      signal,
    })
  ).data;
export function validateInventoryUnitTrace(
  result: InventoryUnitTraceResponse,
  companyId: string,
  code: string,
  page: number,
): void {
  const unit = result?.unit;
  const inventoryValid = (inventory: UnitTraceInventory | undefined) =>
    Boolean(inventory?.id && typeof inventory.name === "string");
  if (
    !result ||
    result.companyId !== companyId ||
    !unit?.id ||
    !unit.variantId ||
    !unit.inventoryItemId ||
    typeof unit.code !== "string" ||
    normalizeUnitTraceCode(unit.code) !== normalizeUnitTraceCode(code) ||
    !["SERIAL", "IMEI"].includes(unit.trackingMode) ||
    !["AVAILABLE", "RESERVED", "SOLD", "WRITTEN_OFF"].includes(unit.status) ||
    !inventoryValid(unit.inventory) ||
    !Number.isSafeInteger(unit.locationVersion) ||
    unit.locationVersion < 0 ||
    !Array.isArray(result.data) ||
    result.meta?.page !== page ||
    !Number.isSafeInteger(result.meta.total) ||
    result.meta.total < 0 ||
    !Number.isSafeInteger(result.meta.totalPages) ||
    result.meta.totalPages < 0 ||
    result.data.some(
      (entry) =>
        !entry.movementId ||
        !Number.isFinite(Date.parse(entry.createdAt)) ||
        !inventoryValid(entry.inventory) ||
        ![0, 1].includes(entry.quantity) ||
        !Number.isFinite(entry.movementQuantity) ||
        ![-1, 0, 1].includes(entry.physicalDelta) ||
        (entry.transfer &&
          (!entry.transfer.operationId ||
            !inventoryValid(entry.transfer.sourceInventory) ||
            !inventoryValid(entry.transfer.destinationInventory))),
    ) ||
    new Set(result.data.map((entry) => entry.movementId)).size !== result.data.length
  ) {
    throw new Error(
      "No se pudo validar el historial de este código en la empresa actual. Inténtalo otra vez.",
    );
  }
}

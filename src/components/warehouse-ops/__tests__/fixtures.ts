// Datos de prueba de la operación de almacén (FEAT-24 H5). No es un test.

import type { CompanyWarehouse } from "@/services/warehousesService";
import type { CountLine, StockAdjustmentDoc, StockCount, Transfer, TransferLine } from "@/services/warehouseOpsService";

export const warehouse = (id: string, name: string, overrides: Partial<CompanyWarehouse> = {}): CompanyWarehouse => ({
  id,
  name,
  status: true,
  store_id: "s-1",
  company_id: "c-1",
  type: "PROPIO",
  is_main: id === "w-1",
  ...overrides,
});

export const WAREHOUSES = [warehouse("w-1", "Central"), warehouse("w-2", "Tienda Sur"), warehouse("w-3", "Shalom", { type: "COURIER" })];

export const transferLine = (id: string, variantId: string, productName: string, quantitySent: number, overrides: Partial<TransferLine> = {}): TransferLine => ({
  id,
  variantId,
  sku: productName.toUpperCase(),
  productName,
  quantitySent,
  quantityReceived: null,
  difference: null,
  differenceDecision: null,
  receivedAt: null,
  ...overrides,
});

export const transfer = (overrides: Partial<Transfer> = {}): Transfer => ({
  id: "t-1",
  number: "TR-0001",
  originInventoryId: "w-1",
  destinationInventoryId: "w-2",
  status: "borrador",
  freight: 15,
  remissionGuide: "T001-15",
  notes: null,
  userEmail: "ana@empresa.pe",
  userName: "ana@empresa.pe",
  dispatchedAt: null,
  receivedAt: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: "2026-11-17T14:00:00Z",
  updatedAt: "2026-11-17T14:00:00Z",
  totalSent: 3,
  totalReceived: 0,
  lines: [transferLine("i-1", "v-1", "Polo", 2), transferLine("i-2", "v-2", "Gorra", 1)],
  ...overrides,
});

export const adjustment = (overrides: Partial<StockAdjustmentDoc> = {}): StockAdjustmentDoc =>
  ({
    id: "a-1",
    number: "AJ-0001",
    inventoryId: "w-1",
    kind: "merma",
    reason: "dano",
    note: "Caja mojada",
    status: "pendiente_aprobacion",
    userEmail: "luis@empresa.pe",
    userName: "luis@empresa.pe",
    createdAt: "2026-11-17T14:00:00Z",
    updatedAt: "2026-11-17T14:00:00Z",
    approvedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    totalValue: 120,
    lines: [{ id: "al-1", variantId: "v-1", sku: "POLO", productName: "Polo", quantityDelta: -4, unitCost: 30, lineValue: 120 }],
    ...overrides,
  }) as StockAdjustmentDoc;

export const countLine = (id: string, productName: string, overrides: Partial<CountLine> = {}): CountLine => ({
  id,
  variantId: `v-${id}`,
  sku: productName.toUpperCase(),
  productName,
  counted: null,
  decision: null,
  ...overrides,
});

export const count = (overrides: Partial<StockCount> = {}): StockCount => ({
  id: "ct-1",
  number: "TI-0004",
  inventoryId: "w-1",
  scope: "total",
  scopeFilter: null,
  blind: true,
  status: "en_curso",
  notes: null,
  userEmail: "ana@empresa.pe",
  userName: "ana@empresa.pe",
  closedAt: null,
  appliedAt: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: "2026-11-17T14:00:00Z",
  updatedAt: "2026-11-17T14:00:00Z",
  ...overrides,
});

/** Un error con la forma de axios. */
export const apiError = (status: number, message: string, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error(message), { isAxiosError: true, response: { status, data: { statusCode: status, message, ...extra } } });

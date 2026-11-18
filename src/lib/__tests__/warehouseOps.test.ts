import { buildSaveBody, draftFromAssignments, draftProblem, sameDraft } from "../userWarehouses";
import {
  buildAdjustmentBody,
  buildTransferReceiveLines,
  canCancelTransfer,
  countDecisionOptions,
  countHidesSystem,
  opsErrorMessage,
  transferFormProblem,
  transferReceiveDraft,
  warehouseOpsAccess,
} from "../warehouseOps";
import { blockingBalances, detailsPatch, locationCodeProblem } from "../warehouseStructure";
import type { Transfer } from "@/services/warehouseOpsService";

// FEAT-24 H5/H6 — reglas puras de la operación de almacén.

jest.mock("@/services/warehouseOpsService", () => ({}));
jest.mock("@/services/purchasesService", () => ({}));
jest.mock("@/services/orderStockService", () => ({}));
jest.mock("@/services/warehousesService", () => ({}));
jest.mock("@/services/variantCodesService", () => ({}));
jest.mock("@/services/inventoryItems.service", () => ({}));

const apiError = (status: number, data: Record<string, unknown>) => ({ isAxiosError: true, response: { status, data } });

const transfer = {
  status: "en_camino",
  lines: [
    { id: "i-1", variantId: "v-1", sku: "POLO", productName: "Polo", quantitySent: 2, quantityReceived: null, receivedAt: null },
    { id: "i-2", variantId: "v-2", sku: "GORRA", productName: "Gorra", quantitySent: 1, quantityReceived: 1, receivedAt: "2026-11-17T10:00:00Z" },
  ],
} as unknown as Transfer;

describe("roles", () => {
  it("Almacén opera sin gestionar; Operaciones gestiona y ve costos; solo el Administrador aprueba", () => {
    expect(warehouseOpsAccess({ role: "ALMACEN" })).toEqual({ operate: true, manage: false, admin: false, seeCosts: false });
    expect(warehouseOpsAccess({ role: "OPERACIONES" })).toEqual({ operate: true, manage: true, admin: false, seeCosts: true });
    expect(warehouseOpsAccess({ role: "ADMINISTRADOR" })).toMatchObject({ admin: true, seeCosts: true });
    expect(warehouseOpsAccess({ role: "VENTAS" })).toEqual({ operate: false, manage: false, admin: false, seeCosts: false });
  });
});

describe("mensajes de error", () => {
  it("423 explica el periodo cerrado; 403 y 409 usan el texto del servidor; sin respuesta, reintentar", () => {
    expect(opsErrorMessage(apiError(423, { code: "PERIODO_CERRADO", period: "2026-10", message: "El periodo 2026-10 está cerrado." }), "x")).toBe(
      "El periodo 2026-10 está cerrado. Para hacer este cambio, el Administrador tiene que reabrir el periodo en Inventario › Cierre mensual.",
    );
    expect(opsErrorMessage(apiError(403, { message: "No tienes acceso a este almacén." }), "x")).toBe("No tienes acceso a este almacén.");
    expect(opsErrorMessage(apiError(409, {}), "x")).toBe("El stock o el estado cambió: actualiza y revisa antes de reintentar.");
    expect(opsErrorMessage(Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK" }), "x")).toBe(
      "No hubo respuesta del servidor. Reintenta: la acción no se duplica.",
    );
  });
});

describe("traslados", () => {
  it("el borrador pide origen y destino distintos y no pasa lo disponible", () => {
    const line = { variantId: "v-1", label: "Polo", sku: "POLO", quantity: "5" };
    const base = { originInventoryId: "w-1", destinationInventoryId: "w-1", freight: "", remissionGuide: "", notes: "", lines: [line] };
    expect(transferFormProblem(base)).toMatch(/distint/);
    expect(transferFormProblem({ ...base, destinationInventoryId: "w-2" }, new Map([["v-1", 3]]))).toMatch(/Polo/);
    expect(transferFormProblem({ ...base, destinationInventoryId: "w-2" }, new Map([["v-1", 9]]))).toBeNull();
  });

  it("recibir: solo las líneas sin recibir; la decisión viaja solo si falta", () => {
    const draft = transferReceiveDraft(transfer, "sent");
    expect(draft.map((line) => line.itemId)).toEqual(["i-1"]);
    expect(buildTransferReceiveLines(draft)).toEqual([{ itemId: "i-1", quantityReceived: 2 }]);
    expect(buildTransferReceiveLines([{ ...draft[0], quantity: "1", decision: "perdida" }])).toEqual([{ itemId: "i-1", quantityReceived: 1, decision: "perdida" }]);
    expect(canCancelTransfer(transfer)).toBe(false);
  });
});

describe("ajustes y conteos", () => {
  it("merma y ajuste negativo salen; positivo entra", () => {
    const form = { inventoryId: "w-1", type: "merma" as const, reason: "dano" as const, note: " ", lines: [{ variantId: "v-1", label: "Polo", sku: "P", quantity: "3" }] };
    expect(buildAdjustmentBody(form, "op-1")).toEqual({ inventoryId: "w-1", kind: "merma", reason: "dano", lines: [{ variantId: "v-1", quantity: 3, direction: "OUT" }], operationId: "op-1" });
    expect(buildAdjustmentBody({ ...form, type: "positivo" }, "op-2").lines[0]).toMatchObject({ direction: "IN" });
    expect(buildAdjustmentBody({ ...form, type: "positivo" }, "op-2").kind).toBe("ajuste");
  });

  it("el conteo ciego oculta el sistema solo mientras está en curso", () => {
    expect(countHidesSystem({ blind: true, status: "en_curso" })).toBe(true);
    expect(countHidesSystem({ blind: true, status: "por_validar" })).toBe(false);
    expect(countHidesSystem({ blind: false, status: "en_curso" })).toBe(false);
  });

  it("decisiones: sobrante solo si sobra, pérdida si falta, courier solo en su almacén", () => {
    expect(countDecisionOptions(2, false)).toEqual(["corregir_origen", "sobrante", "pendiente"]);
    expect(countDecisionOptions(-2, true)).toEqual(["corregir_origen", "perdida", "reclamo_courier", "pendiente"]);
  });
});

describe("estructura y usuarios", () => {
  it("ficha: solo lo que cambió, vacío = null; ubicaciones y saldos", () => {
    const current = { code: "SUR", ubigeo: null, address: "Av. 1", contactName: null, contactPhone: null, sunatEstablishmentCode: null };
    expect(detailsPatch({ code: "SUR", ubigeo: "150101", address: "", contactName: "", contactPhone: "", sunatEstablishmentCode: "" }, current)).toEqual({
      ubigeo: "150101",
      address: null,
    });
    expect(locationCodeProblem("a-01/3")).toBeNull();
    expect(locationCodeProblem("A 01")).not.toBeNull();
    expect(blockingBalances({ physical: 0, reserved: 2, inTransit: 0, pendingReturn: 0, incomingTransfer: 0 })).toEqual(["2 reservas"]);
  });

  it("usuarios y almacenes: «Todos» = lista vacía; con niveles, ve u opera", () => {
    const draft = draftFromAssignments([{ userId: "u-2", inventoryId: "w-1", inventoryName: null, canOperate: true }]);
    expect(draft).toEqual({ all: false, levels: { "w-1": "operate" } });
    expect(buildSaveBody("u-2", { all: false, levels: { "w-1": "operate", "w-2": "view", "w-3": "none" } })).toEqual({
      userId: "u-2",
      warehouses: [
        { inventoryId: "w-1", canOperate: true },
        { inventoryId: "w-2", canOperate: false },
      ],
    });
    expect(buildSaveBody("u-2", { all: true, levels: { "w-1": "view" } })).toEqual({ userId: "u-2", warehouses: [] });
    expect(draftProblem({ all: false, levels: { "w-1": "none" } })).not.toBeNull();
    expect(sameDraft(draftFromAssignments([]), { all: true, levels: { "w-9": "view" } })).toBe(true);
  });
});

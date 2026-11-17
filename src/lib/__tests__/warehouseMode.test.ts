import { createMemo, createOfflineQueue, type ActionHandler, type QueuedAction } from "../offlineQueue";
import { memoryStore } from "../offlineStore";
import {
  buildConsultResult,
  describeQueuedAction,
  fetchConsultResult,
  matchCodeLocally,
  toPickingListRows,
  formatSavedAt,
  pendingForOrder,
  pendingForReception,
  sameReception,
  snapshotKey,
  splitQueue,
  WAREHOUSE_ACTION,
  warehouseAccess,
  warehouseActionHandlers,
} from "../warehouseMode";
import { completePicking, confirmPickingLine, getPicking, scanPicking, type PickingView } from "@/services/orderStockService";
import { listReturnReceptions, receiveReturnReception, type ReturnReception } from "@/services/warehousesService";
import { fetchVariantsByIds, lookupVariantsByCodes, type CatalogVariant } from "@/services/variantCodesService";
import { getStockByVariants } from "@/services/inventoryItems.service";

// FEAT-24 H6-D — modo almacén: acceso, acciones de la cola (envío y
// verificación tras un envío sin respuesta) y la consulta por código.

jest.mock("@/services/orderStockService", () => ({
  getPicking: jest.fn(),
  scanPicking: jest.fn(),
  confirmPickingLine: jest.fn(),
  completePicking: jest.fn(),
}));
jest.mock("@/services/warehousesService", () => ({
  listReturnReceptions: jest.fn(),
  receiveReturnReception: jest.fn(),
}));
jest.mock("@/services/purchasesService", () => ({
  getPurchaseOrder: jest.fn(),
  receivePurchaseOrder: jest.fn(),
}));
jest.mock("@/services/variantCodesService", () => ({
  lookupVariantsByCodes: jest.fn(),
  fetchVariantsByIds: jest.fn(),
}));
jest.mock("@/services/inventoryItems.service", () => ({ getStockByVariants: jest.fn() }));

const networkError = () => Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK" });

function view(picked: number[], overrides: Partial<PickingView> = {}): PickingView {
  return {
    orderId: "o-1",
    orderNumber: "ORD-1",
    status: "EN_ENVIO",
    pickingRequired: false,
    completedAt: null,
    completedBy: null,
    complete: false,
    lines: picked.map((count, index) => ({
      itemId: `i-${index}`,
      productName: `Producto ${index}`,
      sku: `SKU-${index}`,
      variantId: `v-${index}`,
      quantity: 2,
      picked: count,
      manual: 0,
      pending: 2 - count,
      linked: true,
    })),
    ...overrides,
  };
}

function queueWithHandlers() {
  let n = 0;
  return createOfflineQueue({
    store: memoryStore<QueuedAction>((action) => action.id),
    handlers: warehouseActionHandlers(),
    session: () => ({ companyId: "c-1", userId: "u-1" }),
    isOnline: () => true,
    newId: () => `k-${++n}`,
  });
}

beforeEach(() => jest.resetAllMocks());

describe("warehouseAccess", () => {
  const can = (list: string[]) => (permission: string) => list.includes(permission);

  it("el rol Almacén recibe devoluciones; el picking va por permiso", () => {
    expect(warehouseAccess({ role: "ALMACEN", permissions: [] }, can(["UPDATE_DELIVERY_STATUS"]))).toEqual({
      consult: true,
      picking: true,
      receiveReturns: true,
      receivePurchases: true,
    });
  });

  it("Ventas solo consulta", () => {
    expect(warehouseAccess({ role: "VENTAS" }, can(["VIEW_SALES"]))).toEqual({
      consult: true,
      picking: false,
      receiveReturns: false,
      receivePurchases: false,
    });
  });

  it("Operaciones y Administrador reciben (como en Inventario › Recepciones)", () => {
    expect(warehouseAccess({ role: "OPERACIONES" }, can(["MANAGE_OPERATIONS"])).receiveReturns).toBe(true);
    expect(warehouseAccess({ role: "ADMINISTRADOR" }, can([])).receiveReturns).toBe(true);
  });
});

describe("escaneo de picking en la cola", () => {
  it("guarda cuántas unidades había antes de enviar y envía con la clave y el timeout", async () => {
    jest.mocked(getPicking).mockResolvedValue(view([0, 1]));
    jest.mocked(scanPicking).mockResolvedValue(view([1, 1]));
    const queue = queueWithHandlers();
    await expect(queue.enqueue(WAREHOUSE_ACTION.pickingScan, { orderId: "o-1", orderNumber: "ORD-1", code: "775" })).resolves.toMatchObject({
      status: "done",
    });
    expect(scanPicking).toHaveBeenCalledWith("o-1", "775", { idempotencyKey: "k-1", timeoutMs: 15_000 });
  });

  it("tras un timeout NO reenvía si el picking ya sumó la unidad", async () => {
    jest.mocked(getPicking).mockResolvedValueOnce(view([0, 1])).mockResolvedValueOnce(view([1, 1]));
    jest.mocked(scanPicking).mockRejectedValueOnce(networkError());
    const queue = queueWithHandlers();
    await expect(queue.enqueue(WAREHOUSE_ACTION.pickingScan, { orderId: "o-1", orderNumber: "ORD-1", code: "775" })).resolves.toMatchObject({
      status: "queued",
      reason: "no_response",
    });
    await expect(queue.flush()).resolves.toEqual({ applied: 1, review: 0, stopped: null });
    expect(scanPicking).toHaveBeenCalledTimes(1);
  });

  it("tras un timeout reenvía (con la misma clave) si el picking no cambió", async () => {
    jest.mocked(getPicking).mockResolvedValue(view([0, 1]));
    jest.mocked(scanPicking).mockRejectedValueOnce(networkError()).mockResolvedValueOnce(view([1, 1]));
    const queue = queueWithHandlers();
    await queue.enqueue(WAREHOUSE_ACTION.pickingScan, { orderId: "o-1", orderNumber: "ORD-1", code: "775" });
    await queue.flush();
    expect(scanPicking).toHaveBeenCalledTimes(2);
    expect(jest.mocked(scanPicking).mock.calls.map((call) => call[2]?.idempotencyKey)).toEqual(["k-1", "k-1"]);
  });

  it("los escaneos siguientes del mismo pedido usan el total que devolvió el anterior (sin otra lectura)", async () => {
    jest.mocked(getPicking).mockResolvedValue(view([0, 0]));
    jest.mocked(scanPicking).mockResolvedValueOnce(view([1, 0])).mockResolvedValueOnce(view([2, 0]));
    const queue = queueWithHandlers();
    await queue.enqueue(WAREHOUSE_ACTION.pickingScan, { orderId: "o-1", orderNumber: "ORD-1", code: "A" });
    await queue.enqueue(WAREHOUSE_ACTION.pickingScan, { orderId: "o-1", orderNumber: "ORD-1", code: "A" });
    expect(getPicking).toHaveBeenCalledTimes(1);
  });
});

describe("completar y confirmar línea en la cola", () => {
  it("completar: tras un envío sin respuesta, si el picking ya tiene completedAt no lo reenvía", async () => {
    jest.mocked(completePicking).mockRejectedValueOnce(networkError());
    jest.mocked(getPicking).mockResolvedValue(view([2], { completedAt: "2026-11-17T10:00:00Z", status: "DESPACHADO" }));
    const queue = queueWithHandlers();
    await queue.enqueue(WAREHOUSE_ACTION.pickingComplete, { orderId: "o-1", orderNumber: "ORD-1" });
    await expect(queue.flush()).resolves.toEqual({ applied: 1, review: 0, stopped: null });
    expect(completePicking).toHaveBeenCalledTimes(1);
  });

  it("completar: 503 = el despacho quedó pendiente; no va a revisar", async () => {
    jest.mocked(completePicking).mockRejectedValueOnce({ isAxiosError: true, response: { status: 503, data: {} } });
    const queue = queueWithHandlers();
    await expect(queue.enqueue(WAREHOUSE_ACTION.pickingComplete, { orderId: "o-1", orderNumber: "ORD-1" })).resolves.toMatchObject({
      status: "done",
      message: expect.stringMatching(/se reintenta solo/),
    });
  });

  it("completar: un 409 guardado sin señal va a revisar con el mensaje", async () => {
    let online = false;
    const queue = createOfflineQueue({
      store: memoryStore<QueuedAction>((action) => action.id),
      handlers: warehouseActionHandlers(),
      session: () => ({ companyId: "c-1", userId: "u-1" }),
      isOnline: () => online,
    });
    await queue.enqueue(WAREHOUSE_ACTION.pickingComplete, { orderId: "o-1", orderNumber: "ORD-1" });
    online = true;
    jest.mocked(completePicking).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 409, data: { message: "El pedido está en DESPACHADO: el picking es antes del despacho." } },
    });
    await expect(queue.flush()).resolves.toMatchObject({ review: 1 });
    expect((await queue.list())[0].lastError).toBe("El pedido está en DESPACHADO: el picking es antes del despacho.");
  });

  it("confirmar línea: verifica por la línea pendiente", async () => {
    jest.mocked(confirmPickingLine).mockRejectedValueOnce(networkError());
    jest.mocked(getPicking).mockResolvedValue(view([2]));
    const queue = queueWithHandlers();
    await queue.enqueue(WAREHOUSE_ACTION.pickingConfirmLine, { orderId: "o-1", orderNumber: "ORD-1", itemId: "i-0" });
    await expect(queue.flush()).resolves.toMatchObject({ applied: 1 });
    expect(confirmPickingLine).toHaveBeenCalledTimes(1);
  });
});

describe("recibir devolución en la cola", () => {
  const body = { lines: [{ variantId: "V-1", quantity: 2, result: "reingreso" as const }] };
  function received(overrides: Partial<ReturnReception> = {}): ReturnReception {
    return {
      id: "r-1",
      companyId: "c-1",
      orderId: "o-1",
      orderNumber: "ORD-1",
      inventoryId: "inv-1",
      status: "recibida",
      lines: [{ variantId: "v-1", quantity: 2 }],
      createdAt: "2026-11-17T10:00:00Z",
      receivedAt: "2026-11-17T11:00:00Z",
      receivedBy: "u-2",
      receivedByName: "ana@powip.test",
      receivedInventoryId: "inv-1",
      receivedLines: [{ variantId: "v-1", quantity: 2, result: "reingreso", reason: null }],
      ...overrides,
    };
  }

  it("tras un envío sin respuesta busca la devolución: si coincide, no la reenvía", async () => {
    jest.mocked(receiveReturnReception).mockRejectedValueOnce(networkError());
    jest.mocked(listReturnReceptions).mockResolvedValue([received()]);
    const queue = queueWithHandlers();
    await queue.enqueue(WAREHOUSE_ACTION.returnReceive, { receptionId: "r-1", orderLabel: "ORD-1", body });
    await expect(queue.flush()).resolves.toMatchObject({ applied: 1 });
    expect(listReturnReceptions).toHaveBeenCalledWith("recibida");
    expect(receiveReturnReception).toHaveBeenCalledTimes(1);
  });

  it("si otra persona la recibió distinto, va a revisar sin reenviar", async () => {
    jest.mocked(receiveReturnReception).mockRejectedValueOnce(networkError());
    jest.mocked(listReturnReceptions).mockResolvedValue([
      received({ receivedLines: [{ variantId: "v-1", quantity: 2, result: "merma", reason: "roto" }] }),
    ]);
    const queue = queueWithHandlers();
    await queue.enqueue(WAREHOUSE_ACTION.returnReceive, { receptionId: "r-1", orderLabel: "ORD-1", body });
    await expect(queue.flush()).resolves.toMatchObject({ review: 1 });
    expect((await queue.list())[0].lastError).toMatch(/otras cantidades \(la registró ana@powip.test\)/);
    expect(receiveReturnReception).toHaveBeenCalledTimes(1);
  });

  it("si no está entre las recibidas, la reenvía", async () => {
    jest.mocked(receiveReturnReception).mockRejectedValueOnce(networkError()).mockResolvedValueOnce(received());
    jest.mocked(listReturnReceptions).mockResolvedValue([]);
    const queue = queueWithHandlers();
    await queue.enqueue(WAREHOUSE_ACTION.returnReceive, { receptionId: "r-1", orderLabel: "ORD-1", body });
    await queue.flush();
    expect(receiveReturnReception).toHaveBeenCalledTimes(2);
  });

  it("sameReception compara cantidades por producto y resultado, y el almacén de reingreso", () => {
    expect(sameReception(received(), body)).toBe(true);
    expect(sameReception(received(), { ...body, inventoryId: "inv-2" })).toBe(false);
    expect(sameReception(received(), { lines: [{ variantId: "v-1", quantity: 1, result: "reingreso" }] })).toBe(false);
    expect(
      sameReception(received({ receivedLines: [{ variantId: "v-1", quantity: 1, result: "reingreso", reason: null }, { variantId: "v-1", quantity: 1, result: "reingreso", reason: null }] }), body),
    ).toBe(true);
  });
});

describe("bandeja y textos", () => {
  const action = (overrides: Partial<QueuedAction>): QueuedAction => ({
    id: "a",
    kind: WAREHOUSE_ACTION.pickingScan,
    payload: { orderId: "o-1", orderNumber: "ORD-1", code: "775" },
    companyId: "c-1",
    userId: "u-1",
    seq: 1,
    createdAt: 1,
    updatedAt: 1,
    status: "pending",
    attempts: 0,
    ...overrides,
  });

  it("describe cada acción", () => {
    expect(describeQueuedAction(action({}))).toBe("Escaneo 775 · ORD-1");
    expect(describeQueuedAction(action({ kind: WAREHOUSE_ACTION.pickingComplete }))).toBe("Completar picking · ORD-1");
    expect(describeQueuedAction(action({ kind: WAREHOUSE_ACTION.pickingConfirmLine, payload: { orderNumber: "ORD-1", lineName: "Polo" } }))).toBe(
      "Confirmar sin escanear Polo · ORD-1",
    );
    expect(describeQueuedAction(action({ kind: WAREHOUSE_ACTION.returnReceive, payload: { orderLabel: "ORD-9" } }))).toBe("Recibir devolución ORD-9");
  });

  it("separa por enviar, para revisar y lo de otras sesiones", () => {
    const actions = [
      action({ id: "1" }),
      action({ id: "2", status: "review" }),
      action({ id: "3", userId: "u-2" }),
      action({ id: "4", kind: WAREHOUSE_ACTION.returnReceive, payload: { receptionId: "r-1" } }),
    ];
    const split = splitQueue(actions, { companyId: "c-1", userId: "u-1" });
    expect(split.outbox.map((row) => row.id)).toEqual(["1", "4"]);
    expect(split.review.map((row) => row.id)).toEqual(["2"]);
    expect(split.otherSessions).toBe(1);
    expect(pendingForOrder(split.outbox, "o-1")).toBe(1);
    expect(pendingForReception(split.outbox, "r-1")).toBe(true);
    expect(splitQueue(actions, null).otherSessions).toBe(4);
  });

  it("formatSavedAt y snapshotKey", () => {
    const now = Date.UTC(2026, 10, 17, 20, 0);
    expect(formatSavedAt(now - 10_000, now)).toBe("hace un momento");
    expect(formatSavedAt(now - 5 * 60_000, now)).toBe("hace 5 min");
    expect(formatSavedAt(Date.UTC(2026, 10, 17, 15, 5), now)).toBe("17/11 10:05");
    expect(snapshotKey({ companyId: "c", userId: "u" }, "consult", "775")).toBe("c:u:consult:775");
  });
});

describe("buildConsultResult", () => {
  it("junta producto, variante y stock por almacén (más disponible primero)", () => {
    const result = buildConsultResult(
      "775",
      [
        { code: "775", variantId: "V-1", sku: "POL-M", companySku: null, productId: "p-1", productName: "Polo", matchedBy: "powipEan" },
        { code: "775", variantId: "v-1", sku: "POL-M", companySku: null, productId: "p-1", productName: "Polo" },
      ],
      [{ id: "v-1", sku: "POL-M", companySku: "EMP-1", barcode: null, powipEan: "775", attributeValues: { Talla: "M" }, productName: "Polo negro" }],
      [
        {
          variant_id: "v-1",
          quantity: 7,
          reserved_quantity: 3,
          available: 4,
          inventories: [
            { inventory_id: "a", inventory_name: "Sur", store_id: null, quantity: 2, reserved_quantity: 2 },
            { inventory_id: "b", inventory_name: "Central", store_id: null, quantity: 5, reserved_quantity: 1 },
          ],
        },
      ],
    );
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0]).toMatchObject({
      productName: "Polo negro",
      attributes: "Talla: M",
      companySku: "EMP-1",
      matchedBy: "powipEan",
      totals: { physical: 7, reserved: 3, available: 4 },
    });
    expect(result.variants[0].warehouses.map((row) => [row.name, row.available])).toEqual([
      ["Central", 4],
      ["Sur", 0],
    ]);
  });

  it("sin stock ni datos de la variante, muestra lo que trajo el código", () => {
    const result = buildConsultResult("X", [{ code: "X", variantId: "v-9", sku: "S9", companySku: null, productId: "p", productName: "Gorra" }], [], []);
    expect(result.variants[0]).toMatchObject({ productName: "Gorra", sku: "S9", warehouses: [], totals: { physical: 0, reserved: 0, available: 0 } });
  });
});

describe("fetchConsultResult", () => {
  it("resuelve el código (con códigos de barras), la variante y el stock", async () => {
    jest.mocked(lookupVariantsByCodes).mockResolvedValue([
      { code: "775", variantId: "v-1", sku: "S", companySku: null, productId: "p", productName: "Polo", matchedBy: "powipEan" },
    ]);
    jest.mocked(fetchVariantsByIds).mockRejectedValue(new Error("caído"));
    jest.mocked(getStockByVariants).mockResolvedValue([
      { variant_id: "v-1", quantity: 3, reserved_quantity: 1, available: 2, inventories: [{ inventory_id: "a", inventory_name: "Central", store_id: null, quantity: 3, reserved_quantity: 1 }] },
    ]);
    const result = await fetchConsultResult("775", "c-1");
    expect(lookupVariantsByCodes).toHaveBeenCalledWith(["775"], "c-1");
    expect(getStockByVariants).toHaveBeenCalledWith(["v-1"]);
    expect(result.variants[0]).toMatchObject({ productName: "Polo", totals: { physical: 3, reserved: 1, available: 2 } });
  });

  it("un código que no es de la empresa vuelve sin variantes y sin pedir stock", async () => {
    jest.mocked(lookupVariantsByCodes).mockResolvedValue([]);
    await expect(fetchConsultResult("X", "c-1")).resolves.toEqual({ code: "X", variants: [] });
    expect(getStockByVariants).not.toHaveBeenCalled();
  });
});

describe("matchCodeLocally", () => {
  const variant = (overrides: Partial<CatalogVariant>): CatalogVariant => ({
    id: "v-1",
    sku: "POL-M",
    companySku: null,
    barcode: null,
    powipEan: null,
    attributeValues: {},
    productName: "Polo",
    ...overrides,
  });

  it("busca por SKU, SKU de la empresa, código de fábrica y EAN de POWIP (sin distinguir mayúsculas)", () => {
    const variants = [variant({}), variant({ id: "v-2", sku: "GOR", barcode: "7790001", powipEan: "2000000000015", companySku: "emp-9" })];
    expect(matchCodeLocally("pol-m", variants).map((match) => [match.variantId, match.matchedBy])).toEqual([["v-1", "sku"]]);
    expect(matchCodeLocally("7790001", variants)[0]).toMatchObject({ variantId: "v-2", matchedBy: "barcode" });
    expect(matchCodeLocally("2000000000015", variants)[0]).toMatchObject({ matchedBy: "powipEan" });
    expect(matchCodeLocally("EMP-9", variants)[0]).toMatchObject({ matchedBy: "companySku" });
    expect(matchCodeLocally("nada", variants)).toEqual([]);
    expect(matchCodeLocally("  ", variants)).toEqual([]);
  });
});

describe("toPickingListRows", () => {
  it("guarda solo lo que muestra la lista", () => {
    expect(
      toPickingListRows([{ id: "o-1", orderNumber: "ORD-1", status: "EN_ENVIO", stockState: "reserved", customer: { fullName: "Ana" } }]),
    ).toEqual([{ id: "o-1", orderNumber: "ORD-1", customerName: "Ana", status: "EN_ENVIO", stockState: "reserved" }]);
  });
});

describe("createMemo", () => {
  it("olvida los valores vencidos", () => {
    let now = 0;
    const memo = createMemo(1_000, () => now);
    memo.set("a", 1);
    now = 500;
    expect(memo.get("a")).toBe(1);
    now = 1_600;
    expect(memo.get("a")).toBeUndefined();
  });
});

// Evita que el tipo de los manejadores se rompa sin que nadie lo note.
const handlersTyped: Record<string, ActionHandler<never, unknown>> = warehouseActionHandlers();
void handlersTyped;

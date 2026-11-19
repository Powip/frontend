import { createOfflineQueue, type QueuedAction } from "../offlineQueue";
import { memoryStore } from "../offlineStore";
import { describeQueuedAction, pendingForPurchaseOrder, WAREHOUSE_ACTION, warehouseActionHandlers } from "../warehouseMode";
import { getPurchaseOrder, receivePurchaseOrder, type PurchaseOrderDetail } from "@/services/purchasesService";

// FEAT-24 H3-E — recibir órdenes de compra en el modo almacén por la cola sin
// conexión: el checkpoint antes del primer envío y la verificación (por el
// operationId de la recepción) antes de reenviar.

jest.mock("@/services/purchasesService", () => ({ getPurchaseOrder: jest.fn(), receivePurchaseOrder: jest.fn() }));
jest.mock("@/services/orderStockService", () => ({}));
jest.mock("@/services/warehousesService", () => ({}));
jest.mock("@/services/variantCodesService", () => ({}));
jest.mock("@/services/inventoryItems.service", () => ({}));

const networkError = () => Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK" });

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

function detail(received: number, overrides: Partial<PurchaseOrderDetail> = {}): PurchaseOrderDetail {
  return {
    id: "oc-1",
    number: "OC-0001",
    status: received > 0 ? "RECIBIDA_PARCIAL" : "PEDIDA",
    lines: [{ id: "item-1", variantId: "v-1", quantity: 10, receivedQuantity: received, pendingQuantity: 10 - received }],
    receptions: [],
    ...overrides,
  } as unknown as PurchaseOrderDetail;
}

const body = { lines: [{ itemId: "item-1", quantity: 3 }], operationId: "op-1" };
const payload = { orderId: "oc-1", orderNumber: "OC-0001", body };

beforeEach(() => jest.resetAllMocks());

describe("recibir OC por la cola (modo almacén)", () => {
  it("antes del primer envío guarda lo recibido y envía con el operationId y timeout", async () => {
    jest.mocked(getPurchaseOrder).mockResolvedValue(detail(2));
    jest.mocked(receivePurchaseOrder).mockResolvedValue({ duplicate: false } as never);
    const queue = queueWithHandlers();
    await expect(queue.enqueue(WAREHOUSE_ACTION.purchaseReceive, payload)).resolves.toMatchObject({ status: "done" });
    expect(getPurchaseOrder).toHaveBeenCalledWith("oc-1");
    expect(receivePurchaseOrder).toHaveBeenCalledWith("oc-1", body, expect.objectContaining({ timeoutMs: 15_000 }));
  });

  it("tras un envío sin respuesta, si la OC tiene la recepción con ese operationId, no la reenvía", async () => {
    jest.mocked(getPurchaseOrder)
      .mockResolvedValueOnce(detail(2))
      .mockResolvedValueOnce(detail(5, { receptions: [{ id: "rec-1", number: "REC-0001", operationId: "op-1", lines: [] } as never] }));
    jest.mocked(receivePurchaseOrder).mockRejectedValueOnce(networkError());
    const queue = queueWithHandlers();
    await expect(queue.enqueue(WAREHOUSE_ACTION.purchaseReceive, payload)).resolves.toMatchObject({ status: "queued", reason: "no_response" });
    await expect(queue.flush()).resolves.toMatchObject({ applied: 1 });
    expect(receivePurchaseOrder).toHaveBeenCalledTimes(1);
  });

  it("si no está y todavía alcanza lo pendiente, la reenvía con el mismo operationId", async () => {
    jest.mocked(getPurchaseOrder).mockResolvedValue(detail(2));
    jest.mocked(receivePurchaseOrder).mockRejectedValueOnce(networkError()).mockResolvedValueOnce({ duplicate: false } as never);
    const queue = queueWithHandlers();
    await queue.enqueue(WAREHOUSE_ACTION.purchaseReceive, payload);
    await queue.flush();
    expect(receivePurchaseOrder).toHaveBeenCalledTimes(2);
    expect(jest.mocked(receivePurchaseOrder).mock.calls[1][1]).toEqual(body);
  });

  it("si otra persona recibió en el medio y ya no alcanza lo pendiente, va a revisar sin reenviar", async () => {
    jest.mocked(getPurchaseOrder).mockResolvedValueOnce(detail(2)).mockResolvedValueOnce(detail(9));
    jest.mocked(receivePurchaseOrder).mockRejectedValueOnce(networkError());
    const queue = queueWithHandlers();
    await queue.enqueue(WAREHOUSE_ACTION.purchaseReceive, payload);
    await expect(queue.flush()).resolves.toMatchObject({ review: 1 });
    expect((await queue.list())[0].lastError).toMatch(/Otra persona recibió parte de OC-0001/);
    expect(receivePurchaseOrder).toHaveBeenCalledTimes(1);
  });

  it("FEAT-24 H5-L: con la línea partida en lotes compara la suma con lo pendiente", async () => {
    const split = { ...payload, body: { ...body, lines: [{ itemId: "item-1", quantity: 3, lotNumber: "L1", expiresAt: "2027-01-31" }, { itemId: "item-1", quantity: 2, lotNumber: "L2", expiresAt: "2027-02-28" }] } };
    // Quedan 3 pendientes: 3 + 2 ya no alcanza (cada lote por separado sí).
    jest.mocked(getPurchaseOrder).mockResolvedValueOnce(detail(2)).mockResolvedValueOnce(detail(7));
    jest.mocked(receivePurchaseOrder).mockRejectedValueOnce(networkError());
    const queue = queueWithHandlers();
    await queue.enqueue(WAREHOUSE_ACTION.purchaseReceive, split);
    await expect(queue.flush()).resolves.toMatchObject({ review: 1 });
    expect(receivePurchaseOrder).toHaveBeenCalledTimes(1);
  });

  it("si la OC se anuló, va a revisar", async () => {
    jest.mocked(getPurchaseOrder).mockResolvedValueOnce(detail(0)).mockResolvedValueOnce(detail(0, { status: "ANULADA" }));
    jest.mocked(receivePurchaseOrder).mockRejectedValueOnce(networkError());
    const queue = queueWithHandlers();
    await queue.enqueue(WAREHOUSE_ACTION.purchaseReceive, payload);
    await queue.flush();
    expect((await queue.list())[0].lastError).toBe("OC-0001 ya no se puede recibir (Anulada). Revísala en Compras.");
  });

  it("un 409 del servidor (más de lo pendiente) va a revisar con su mensaje", async () => {
    jest.mocked(getPurchaseOrder).mockResolvedValue(detail(2));
    jest.mocked(receivePurchaseOrder).mockRejectedValue({ response: { status: 409, data: { message: "POLO-M: quedan 2 pendientes." } } });
    const queue = queueWithHandlers();
    await expect(queue.enqueue(WAREHOUSE_ACTION.purchaseReceive, payload)).resolves.toMatchObject({
      status: "rejected",
      message: "POLO-M: quedan 2 pendientes.",
    });
  });

  it("texto para «Para revisar» y aviso de recepción guardada", () => {
    const action = { id: "a", kind: WAREHOUSE_ACTION.purchaseReceive, payload } as QueuedAction;
    expect(describeQueuedAction(action)).toBe("Recibir compra · OC-0001");
    expect(pendingForPurchaseOrder([action], "oc-1")).toBe(true);
    expect(pendingForPurchaseOrder([action], "oc-2")).toBe(false);
  });
});

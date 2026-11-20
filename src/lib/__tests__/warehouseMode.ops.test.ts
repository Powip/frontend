import { createOfflineQueue, type QueuedAction } from "../offlineQueue";
import { memoryStore } from "../offlineStore";
import { describeQueuedAction, pendingCountScans, pendingForTransfer, WAREHOUSE_ACTION, warehouseActionHandlers } from "../warehouseMode";
import { addCountEntries, receiveTransfer } from "@/services/warehouseOpsService";

// FEAT-24 H5 — traslados y conteos en el modo almacén por la cola sin conexión:
// la recepción de un traslado lleva su operationId y se reenvía igual; cada
// escaneo de conteo usa la clave de la acción como operationId (estable en los
// reintentos) y un código sin resolver no suma.

jest.mock("@/services/warehouseOpsService", () => ({ receiveTransfer: jest.fn(), addCountEntries: jest.fn() }));
jest.mock("@/services/purchasesService", () => ({}));
jest.mock("@/services/orderStockService", () => ({}));
jest.mock("@/services/warehousesService", () => ({}));
jest.mock("@/services/variantCodesService", () => ({}));
jest.mock("@/services/inventoryItems.service", () => ({}));

const networkError = () => Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK" });
const conflict = (message: string) => Object.assign(new Error(message), { response: { status: 409, data: { message } } });

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

const transferBody = { lines: [{ itemId: "i-1", quantityReceived: 2 }], operationId: "op-tr-1" };
const transferPayload = { transferId: "t-1", transferNumber: "TR-0001", body: transferBody };
const countPayload = { countId: "ct-1", countNumber: "TI-0004", code: "7750001" };
const entries = (applied: number) => ({
  countId: "ct-1",
  status: "en_curso" as const,
  applied: applied ? [{ lineId: "l-1", variantId: "v-1", counted: applied }] : [],
  unresolved: applied ? [] : [{ code: "7750001", variantId: null, quantity: 1, reason: "no_encontrado" as const }],
  duplicate: false,
});

beforeEach(() => jest.resetAllMocks());

describe("recibir traslados por la cola", () => {
  it("envía el cuerpo con su operationId y el timeout del modo almacén", async () => {
    jest.mocked(receiveTransfer).mockResolvedValue({ duplicate: false } as never);
    const queue = queueWithHandlers();
    await expect(queue.enqueue(WAREHOUSE_ACTION.transferReceive, transferPayload)).resolves.toMatchObject({ status: "done" });
    expect(receiveTransfer).toHaveBeenCalledWith("t-1", transferBody, 15_000);
  });

  it("tras un envío sin respuesta la reenvía con el MISMO operationId (logistics no la duplica)", async () => {
    jest.mocked(receiveTransfer).mockRejectedValueOnce(networkError()).mockResolvedValueOnce({ duplicate: true } as never);
    const queue = queueWithHandlers();
    await expect(queue.enqueue(WAREHOUSE_ACTION.transferReceive, transferPayload)).resolves.toMatchObject({ status: "queued", reason: "no_response" });
    await expect(queue.flush()).resolves.toMatchObject({ applied: 1 });
    expect(receiveTransfer).toHaveBeenCalledTimes(2);
    expect(jest.mocked(receiveTransfer).mock.calls[1][1].operationId).toBe("op-tr-1");
  });

  it("si otra persona la recibió (409), queda para revisar con el motivo", async () => {
    jest.mocked(receiveTransfer).mockRejectedValueOnce(networkError()).mockRejectedValueOnce(conflict("El traslado ya no está en camino."));
    const queue = queueWithHandlers();
    await queue.enqueue(WAREHOUSE_ACTION.transferReceive, transferPayload);
    await expect(queue.flush()).resolves.toMatchObject({ review: 1 });
    const [saved] = await queue.list();
    expect(saved).toMatchObject({ status: "review", lastError: "El traslado ya no está en camino.", httpStatus: 409 });
  });
});

describe("escaneos de conteo por la cola", () => {
  it("cada escaneo suma 1 con el código tal cual y la clave de la acción como operationId", async () => {
    jest.mocked(addCountEntries).mockResolvedValue(entries(1));
    const queue = queueWithHandlers();
    await expect(queue.enqueue(WAREHOUSE_ACTION.countEntry, countPayload)).resolves.toMatchObject({ status: "done", result: entries(1) });
    expect(addCountEntries).toHaveBeenCalledWith("ct-1", { mode: "add", entries: [{ code: "7750001", quantity: 1 }], operationId: "k-1" }, 15_000);
  });

  it("el reintento tras un envío sin respuesta usa la misma clave: no cuenta dos veces", async () => {
    jest.mocked(addCountEntries).mockRejectedValueOnce(networkError()).mockResolvedValueOnce({ ...entries(1), duplicate: true });
    const queue = queueWithHandlers();
    await queue.enqueue(WAREHOUSE_ACTION.countEntry, countPayload);
    await queue.flush();
    expect(addCountEntries).toHaveBeenCalledTimes(2);
    expect(jest.mocked(addCountEntries).mock.calls.map((call) => call[1].operationId)).toEqual(["k-1", "k-1"]);
  });

  it("un código que el servidor no resuelve se rechaza con el motivo (no sumó nada)", async () => {
    jest.mocked(addCountEntries).mockResolvedValue(entries(0));
    const queue = queueWithHandlers();
    await expect(queue.enqueue(WAREHOUSE_ACTION.countEntry, countPayload)).resolves.toMatchObject({
      status: "rejected",
      message: "El código 7750001 no es de ningún producto de tu catálogo (TI-0004).",
    });
  });
});

describe("bandeja y marcas", () => {
  const action = (overrides: Partial<QueuedAction>): QueuedAction =>
    ({ id: "a", seq: 1, kind: WAREHOUSE_ACTION.countEntry, payload: countPayload, companyId: "c-1", userId: "u-1", status: "pending", attempts: 0, createdAt: 0, updatedAt: 0, ...overrides }) as QueuedAction;

  it("describe las acciones nuevas", () => {
    expect(describeQueuedAction(action({}))).toBe("Escaneo 7750001 · conteo TI-0004");
    expect(describeQueuedAction(action({ kind: WAREHOUSE_ACTION.transferReceive, payload: transferPayload }))).toBe("Recibir traslado TR-0001");
  });

  it("marca el traslado con recepción guardada y junta los escaneos del conteo", () => {
    const outbox = [
      action({ id: "1" }),
      action({ id: "2", payload: { ...countPayload, code: "7750002" } }),
      action({ id: "3", payload: { ...countPayload, countId: "ct-9" } }),
      action({ id: "4", kind: WAREHOUSE_ACTION.transferReceive, payload: transferPayload }),
    ];
    expect(pendingForTransfer(outbox, "t-1")).toBe(true);
    expect(pendingForTransfer(outbox, "t-2")).toBe(false);
    expect(pendingCountScans(outbox, "ct-1").map((scan) => scan.code)).toEqual(["7750001", "7750002"]);
  });
});

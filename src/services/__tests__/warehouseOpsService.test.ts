import axiosAuth from "@/lib/axiosAuth";
import { addCountEntries, applyCount, approveAdjustment, dispatchTransfer, receiveTransfer, removeFromWarehouse } from "../warehouseOpsService";

// FEAT-24 H5 — con NEXT_PUBLIC_IDEMPOTENCY_HEADER=on, el header Idempotency-Key
// es SIEMPRE el operationId del cuerpo (la fachada rechaza con 400 si difieren).

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { post: jest.fn(), get: jest.fn(), put: jest.fn(), delete: jest.fn() } }));

const post = jest.mocked(axiosAuth.post);
const saved = process.env.NEXT_PUBLIC_IDEMPOTENCY_HEADER;

beforeEach(() => {
  jest.clearAllMocks();
  post.mockResolvedValue({ data: { duplicate: false } });
});
afterEach(() => {
  process.env.NEXT_PUBLIC_IDEMPOTENCY_HEADER = saved;
});

describe("Idempotency-Key de la operación de almacén", () => {
  it("con el header habilitado viaja el mismo operationId del cuerpo, con timeout", async () => {
    process.env.NEXT_PUBLIC_IDEMPOTENCY_HEADER = "on";
    await dispatchTransfer("t-1", { operationId: "op-1" });
    await receiveTransfer("t-1", { lines: [{ itemId: "i-1", quantityReceived: 1 }], operationId: "op-2" }, 15_000);
    await approveAdjustment("a-1", { operationId: "op-3" });
    await addCountEntries("ct-1", { mode: "add", entries: [{ code: "775", quantity: 1 }], operationId: "op-4" });
    await applyCount("ct-1", { operationId: "op-5" });
    const headers = post.mock.calls.map((call) => (call[2] as { headers?: Record<string, string> } | undefined)?.headers?.["Idempotency-Key"]);
    expect(headers).toEqual(["op-1", "op-2", "op-3", "op-4", "op-5"]);
    expect(post.mock.calls[0][1]).toEqual({ operationId: "op-1" });
    expect(post.mock.calls[1][2]).toMatchObject({ timeout: 15_000 });
  });

  it("sin el header habilitado solo va en el cuerpo", async () => {
    delete process.env.NEXT_PUBLIC_IDEMPOTENCY_HEADER;
    await dispatchTransfer("t-1", { operationId: "op-1" });
    expect((post.mock.calls[0][2] as { headers?: unknown } | undefined)?.headers).toBeUndefined();
    expect(post.mock.calls[0][1]).toEqual({ operationId: "op-1" });
  });
});

describe("Quitar del almacén (FEAT-24 RMV)", () => {
  it("va a la fachada con la variante o el producto, sin empresa ni usuario, y con timeout", async () => {
    post.mockResolvedValue({ data: { inventoryId: "inv 1", removed: [], alreadyRemoved: [], notInWarehouse: [] } });
    await removeFromWarehouse("inv 1", { variantId: "v-1" });
    await removeFromWarehouse("inv 1", { productId: "p-1" });
    expect(post.mock.calls[0][0]).toMatch(/\/warehouses\/inv%201\/remove-items$/);
    expect(post.mock.calls[0][1]).toEqual({ variantId: "v-1" });
    expect(post.mock.calls[1][1]).toEqual({ productId: "p-1" });
    expect(post.mock.calls[0][2]).toMatchObject({ timeout: 30_000 });
  });
});

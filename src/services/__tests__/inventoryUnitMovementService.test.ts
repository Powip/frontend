import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import {
  getAvailableInventoryUnits,
  getInventoryUnitOperation,
  inventoryUnitMovementKey,
  readInventoryUnitMovement,
  saveInventoryUnitMovement,
  submitInventoryUnitMovement,
  validateInventoryMovementReceipt,
  type InventoryUnitMovementReceipt,
  type PendingInventoryUnitMovement,
} from "../inventoryUnitMovementService";
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
const source = {
  inventoryItemId: "item",
  variantId: "variant",
  inventoryId: "origin",
  inventoryName: "Origen",
  productName: "Producto",
  sku: "SKU",
};
const pending: PendingInventoryUnitMovement = {
  action: "transfer",
  operationId: "op",
  request: {
    operationId: "op",
    sourceInventoryItemId: "item",
    destinationInventoryId: "destination",
    quantity: 1,
    unitIds: ["unit"],
    reason: "Reposición",
  },
};
const receipt: InventoryUnitMovementReceipt = {
  companyId: "company",
  operationId: "op",
  kind: "TRANSFER",
  status: "COMPLETED",
  quantity: 1,
  unitIds: ["unit"],
  sourceInventoryItemId: "item",
  sourceInventoryId: "origin",
  destinationInventoryId: "destination",
  units: [{ id: "unit", code: "000123", status: "AVAILABLE" }],
  movementIds: ["out", "in"],
};
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
});
test("uses Products authenticated endpoints with exact DTO and no client tenant or actor", async () => {
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: receipt });
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: receipt });
  const signal = new AbortController().signal;
  await getAvailableInventoryUnits("item", 2, "000123", signal);
  await submitInventoryUnitMovement("transfer", pending.request);
  await getInventoryUnitOperation("op");
  expect(axiosAuth.get).toHaveBeenCalledWith(
    `${GATEWAY.products}/tracking/items/item/available-units`,
    { params: { page: 2, limit: 20, q: "000123" }, signal },
  );
  expect(axiosAuth.post).toHaveBeenCalledWith(
    `${GATEWAY.products}/tracking/unit-transfers`,
    pending.request,
  );
  expect(axiosAuth.get).toHaveBeenCalledWith(`${GATEWAY.products}/tracking/unit-operations/op`);
  expect(pending.request).not.toHaveProperty("companyId");
  expect(pending.request).not.toHaveProperty("userId");
});
test("merma sends explicit financial zero values and uses its own authenticated endpoint", async () => {
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: {} });
  const request = {
    operationId: "op",
    inventoryItemId: "item",
    quantity: 1,
    unitIds: ["unit"],
    reason: "Daño",
    shrinkageType: "otro" as const,
    unitCost: 0,
    recoveredAmount: 0,
  };
  await submitInventoryUnitMovement("write-off", request);
  expect(axiosAuth.post).toHaveBeenCalledWith(
    `${GATEWAY.products}/tracking/unit-write-offs`,
    request,
  );
});
test("durable snapshots are isolated by company user and source and preserve original request", () => {
  const key = inventoryUnitMovementKey("company", "user", "item");
  saveInventoryUnitMovement(key, pending);
  expect(readInventoryUnitMovement(key, "item")).toEqual(pending);
  expect(
    readInventoryUnitMovement(inventoryUnitMovementKey("company", "other", "item"), "item"),
  ).toBeNull();
  expect(
    readInventoryUnitMovement(inventoryUnitMovementKey("other", "user", "item"), "item"),
  ).toBeNull();
  expect(readInventoryUnitMovement(key, "other-item")).toBeNull();
});
test.each([
  { companyId: "other" },
  { operationId: "other" },
  { sourceInventoryId: "other" },
  { destinationInventoryId: "other" },
  { unitIds: ["other"] },
  { quantity: 2 },
  { units: [{ id: "unit", code: "000123", status: "SOLD" }] },
])("rejects a completed receipt outside the exact request: %j", (difference) => {
  expect(() =>
    validateInventoryMovementReceipt(
      { ...receipt, ...difference } as InventoryUnitMovementReceipt,
      pending,
      "company",
      source,
    ),
  ).toThrow();
});
test("accepts a durable rejection without requiring successful movement fields", () => {
  expect(() =>
    validateInventoryMovementReceipt(
      {
        ...receipt,
        status: "REJECTED",
        sourceInventoryId: undefined,
        units: undefined,
        movementIds: undefined,
        error: { statusCode: 409, message: "Unidad reservada" },
      },
      pending,
      "company",
      source,
    ),
  ).not.toThrow();
});

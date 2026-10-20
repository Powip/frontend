import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import {
  getInventoryUnitTrace,
  normalizeUnitTraceCode,
  validUnitTraceCode,
  validateInventoryUnitTrace,
  type InventoryUnitTraceResponse,
} from "../inventoryUnitTraceService";
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
const response = (): InventoryUnitTraceResponse => ({
  companyId: "company",
  product: null,
  unit: {
    id: "unit",
    code: "001234567890123",
    trackingMode: "IMEI",
    status: "AVAILABLE",
    variantId: "variant",
    inventoryItemId: "item-b",
    locationVersion: 2,
    inventory: { id: "warehouse-b", name: "Sucursal" },
    purchase: null,
    reservedOrderId: null,
    soldOrderId: null,
    createdAt: "2026-10-17T10:00:00Z",
    updatedAt: "2026-10-17T11:00:00Z",
  },
  data: [
    {
      movementId: "movement",
      type: "IN",
      quantity: 1,
      movementQuantity: 10,
      physicalDelta: 1,
      reason: "Compra",
      referenceId: "purchase",
      createdAt: "2026-10-17T10:00:00Z",
      inventory: { id: "warehouse-a", name: "Principal" },
    },
  ],
  meta: { total: 1, totalPages: 1, page: 1, limit: 20 },
});
beforeEach(() => jest.clearAllMocks());
test("authenticates a global exact query preserving leading zeroes without warehouse or client authority", async () => {
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: response() });
  const signal = new AbortController().signal;
  await getInventoryUnitTrace(" 001234567890123 ", 2, signal);
  expect(axiosAuth.get).toHaveBeenCalledWith(`${GATEWAY.products}/tracking/unit-trace`, {
    params: { code: "001234567890123", page: 2, limit: 20 },
    signal,
  });
});
test("normalizes textual serials without converting them to numbers or accepting partial wildcards", () => {
  expect(normalizeUnitTraceCode(" 00ab-01/2 ")).toBe("00AB-01/2");
  expect(validUnitTraceCode(" 00ab-01/2 ")).toBe(true);
  for (const invalid of ["", " ", "ABC*", "A B", "\tABC", "ABC\n", "A".repeat(101)])
    expect(validUnitTraceCode(invalid)).toBe(false);
});
test("accepts a unit in another warehouse and preserves individual versus aggregate movement quantities", () => {
  const result = response();
  expect(() => validateInventoryUnitTrace(result, "company", result.unit.code, 1)).not.toThrow();
  expect(result.data[0]).toMatchObject({ quantity: 1, movementQuantity: 10, physicalDelta: 1 });
});
test.each([
  "tenant",
  "code",
  "page",
  "duplicate movement",
  "aggregate as individual",
  "unknown state",
])("rejects invalid %s results", (invalid) => {
  const result = response();
  if (invalid === "tenant") result.companyId = "other";
  if (invalid === "code") result.unit.code = "001234567890124";
  if (invalid === "page") result.meta.page = 2;
  if (invalid === "duplicate movement") result.data.push(result.data[0]);
  if (invalid === "aggregate as individual") result.data[0].quantity = 10;
  if (invalid === "unknown state") result.unit.status = "UNKNOWN" as never;
  expect(() => validateInventoryUnitTrace(result, "company", "001234567890123", 1)).toThrow(
    "No se pudo validar",
  );
});

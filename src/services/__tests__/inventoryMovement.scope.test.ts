jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
import axiosAuth from "@/lib/axiosAuth";
import { fetchScopedInventoryMovements, filterInventoryMovements, type InventoryMovement } from "../inventoryMovementService";
const get = jest.mocked(axiosAuth.get);
const warehouse = { id: "warehouse-a", name: "Principal", storeId: "store-a" };
const request = { companyId: "company-a", accessToken: "test-token", scope: "business" as const, inventories: [warehouse] };
const row = (id: string, itemId: string | null, name = "Camisa") => ({ id, companyId: "company-a", type: "IN", quantity: 2, reason: null, userEmail: null, userName: null, referenceId: null, created_at: "2026-10-12T19:00:00Z", inventoryItem: itemId ? { id: itemId, sku: "SKU", product: { name } } : null }) as InventoryMovement;
const page = (data: InventoryMovement[], number = 1, totalPages = 1) => ({ data: { data, meta: { page: number, totalPages } } });
beforeEach(() => get.mockReset());
it("keeps complete company history including records without a current item, without extra warehouse reads", async () => {
  get.mockImplementation(async (_, config) => config?.params.page === 1 ? page([row("a", null)], 1, 2) : page([row("b", "inactive-item"), row("a", null)], 2, 2));
  const signal = new AbortController().signal;
  expect(await fetchScopedInventoryMovements({ ...request, signal })).toHaveLength(2);
  expect(get).toHaveBeenCalledTimes(2);
  for (const [url, config] of get.mock.calls) {
    expect(String(url)).toContain("/inventory-movement/company/company-a");
    expect(config?.params).toEqual({ page: expect.any(Number), limit: 100 });
    expect(config?.headers).toEqual({ Authorization: "Bearer test-token" }); expect(config?.signal).toBe(signal);
  }
});
it("resolves store origin with all raw item IDs and retains movements of variants missing enrichment", async () => {
  get.mockImplementation(async (url) => String(url).includes("/inventory-item/inventory/") ? { data: [{ id: "item-no-metadata" }] } : page([row("own", "item-no-metadata", ""), row("other", "other-warehouse-item")]));
  const rows = await fetchScopedInventoryMovements({ ...request, scope: "store", inventories: [warehouse, warehouse] });
  expect(rows).toEqual([expect.objectContaining({ id: "own", inventoryId: "warehouse-a", inventoryName: "Principal" })]);
  expect(get.mock.calls.filter(([url]) => String(url).includes("/inventory-item/inventory/"))).toHaveLength(1);
});
it("finds a search match on a later company page without backend's page-local search filter", async () => {
  get.mockImplementation(async (_, config) => config?.params.page === 1 ? page([row("first", "first", "Camisa")], 1, 2) : page([row("later", "later", "Pantalón")], 2, 2));
  const rows = await fetchScopedInventoryMovements(request);
  expect(filterInventoryMovements(rows, { search: "pantalón", startDate: "2026-10-12", endDate: "2026-10-12" }).map((movement) => movement.id)).toEqual(["later"]);
  for (const [, config] of get.mock.calls) expect(config?.params).not.toHaveProperty("search");
});
it("rejects authorization failure rather than returning an empty history", async () => {
  get.mockRejectedValue(new Error("401 Unauthorized"));
  await expect(fetchScopedInventoryMovements(request)).rejects.toThrow("401");
});
it("fails store history if its raw position response cannot identify origin", async () => {
  get.mockResolvedValue({ data: { data: [] } });
  await expect(fetchScopedInventoryMovements({ ...request, scope: "store" })).rejects.toThrow("origen");
});

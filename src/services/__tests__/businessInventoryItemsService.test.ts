jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
import axiosAuth from "@/lib/axiosAuth";
import { fetchBusinessInventoryItems, filterBusinessInventoryItems } from "../businessInventoryItemsService";

const get = jest.mocked(axiosAuth.get);
const warehouse = { id: "warehouse-a", name: "Principal", storeId: "store-a", storeName: "Tienda A" };
const other = { id: "warehouse-b", name: "Segundo", storeId: "store-b" };
const request = { companyId: "company-a", accessToken: "test-token", inventories: [warehouse, warehouse, other] };
const row = (id: string, available = 3, physical = 4) => ({ inventoryItemId: id, productId: "product-a", variantId: "shared-variant", productName: "Camisa", sku: "SKU", companySku: "C-1", attributes: { Talla: "L" }, availableStock: available, physicalStock: physical });
const response = (data: ReturnType<typeof row>[], page = 1, totalPages = 1) => ({ data: { data, meta: { page, totalPages } } });

describe("Business stock positions", () => {
  beforeEach(() => get.mockReset());
  it("loads all pages of unique warehouses and preserves separate positions for the same variant", async () => {
    get.mockImplementation(async (_, config) => config?.params.inventoryId === other.id ? response([row("item-c", 5, 6)]) : config?.params.page === 1 ? response([row("item-a"), row("item-a")], 1, 2) : response([row("item-b")], 2, 2));
    const signal = new AbortController().signal;
    const rows = await fetchBusinessInventoryItems({ ...request, signal });
    expect(rows.map((item) => item.inventoryItemId).sort()).toEqual(["item-a", "item-b", "item-c"]);
    expect(rows.reduce((sum, item) => sum + item.physicalStock, 0)).toBe(14);
    expect(rows.reduce((sum, item) => sum + item.availableStock, 0)).toBe(11);
    expect(get).toHaveBeenCalledTimes(3);
    for (const [, config] of get.mock.calls) {
      expect(config).toMatchObject({ params: { companyId: "company-a", limit: 100 }, headers: { Authorization: "Bearer test-token" } });
      expect(config?.signal).toBe(signal);
    }
    expect(rows.find((item) => item.inventoryItemId === "item-c")).toMatchObject({ inventoryId: "warehouse-b", inventoryName: "Segundo", storeId: "store-b" });
  });
  it("continues across an empty enrichment page rather than omitting later stock", async () => {
    get.mockImplementation(async (_, config) => config?.params.page === 1 ? response([], 1, 2) : response([row("late")], 2, 2));
    expect(await fetchBusinessInventoryItems({ ...request, inventories: [warehouse] })).toHaveLength(1);
    expect(get).toHaveBeenCalledTimes(2);
  });
  it("filters the complete union by origin and variant attributes without changing row identity", async () => {
    get.mockImplementation(async (_, config) => response([row(config?.params.inventoryId)]));
    const rows = await fetchBusinessInventoryItems(request);
    expect(filterBusinessInventoryItems(rows, "all", "l")).toHaveLength(2);
    expect(filterBusinessInventoryItems(rows, "warehouse-b", "c-1").map((item) => item.inventoryItemId)).toEqual(["warehouse-b"]);
    expect(filterBusinessInventoryItems(rows, "all", "absent")).toHaveLength(0);
  });
  it("fails the whole scoped read when one warehouse is unauthorized", async () => {
    get.mockImplementation(async (_, config) => { if (config?.params.inventoryId === other.id) throw new Error("401 Unauthorized"); return response([row("item-a")]); });
    await expect(fetchBusinessInventoryItems(request)).rejects.toThrow("401 Unauthorized");
  });
  it("rejects malformed pagination instead of treating it as empty stock", async () => {
    get.mockResolvedValue({ data: { data: [], meta: { page: 1, totalPages: undefined } } });
    await expect(fetchBusinessInventoryItems(request)).rejects.toThrow("interpretar");
  });
});

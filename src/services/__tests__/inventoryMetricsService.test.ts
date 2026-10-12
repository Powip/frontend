jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));

import axiosAuth from "@/lib/axiosAuth";
import { aggregateInventoryStock, fetchInventoryMetrics } from "../inventoryMetricsService";

const get = jest.mocked(axiosAuth.get);
const request = {
  companyId: "company-a",
  accessToken: "test-token",
  scope: "business" as const,
  storeIds: ["sales-store", "owner-store"],
};
const catalog = {
  companyId: "company-a",
  stores: [{ id: "sales-store" }, { id: "owner-store" }],
  inventoryStoreIds: ["sales-store", "owner-store", "legacy-owner"],
  inventories: [
    { id: "warehouse-a", name: "Principal", storeId: "owner-store" },
    { id: "warehouse-a", name: "Principal", storeId: "owner-store" },
    { id: "warehouse-b", name: "Anterior", storeId: "legacy-owner" },
  ],
};
function row(
  id: string,
  available: number | string,
  physical: number | string,
  variant = "variant-a",
) {
  return {
    inventoryItemId: id,
    variantId: variant,
    productId: "product-a",
    productName: "Producto",
    sku: "SKU",
    availableStock: available,
    physicalStock: physical,
    category: "General",
    min_stock: 2,
  };
}
function page(data: ReturnType<typeof row>[], number = 1, totalPages = 1) {
  return { data: { data, meta: { page: number, limit: 100, total: data.length, totalPages } } };
}
function searchCalls() {
  return get.mock.calls.filter(([url]) => String(url).endsWith("/inventory-item/search"));
}

describe("Inventory metrics physical warehouse scope", () => {
  beforeEach(() => get.mockReset());

  it("loads every company warehouse once, including legacy owners, and combines SKU stock positions", async () => {
    get.mockImplementation(async (url, config) => {
      if (String(url).endsWith("/sale-context")) return { data: catalog };
      if (config?.params.inventoryId === "warehouse-a") return page([row("item-a", "8", "10")]);
      if (config?.params.inventoryId === "warehouse-b") return page([row("item-b", 3, 4)]);
      throw new Error("Unexpected inventory request");
    });
    const signal = new AbortController().signal;
    const items = await fetchInventoryMetrics({ ...request, signal });
    expect(items).toHaveLength(2);
    expect(aggregateInventoryStock(items)).toEqual([
      expect.objectContaining({
        variantId: "variant-a",
        availableStock: 11,
        physicalStock: 14,
        min_stock: 4,
      }),
    ]);
    expect(
      searchCalls()
        .map(([, config]) => config?.params.inventoryId)
        .sort(),
    ).toEqual(["warehouse-a", "warehouse-b"]);
    expect(get.mock.calls.some(([url]) => String(url).includes("shopify/status"))).toBe(false);
    for (const [, config] of get.mock.calls) {
      expect(config?.headers).toEqual({ Authorization: "Bearer test-token" });
      expect(config?.signal).toBe(signal);
    }
    for (const [, config] of searchCalls())
      expect(config?.params).toMatchObject({ companyId: "company-a", page: 1, limit: 100 });
  });

  it("follows pagination metadata across empty enrichment pages and deduplicates repeated stock items", async () => {
    get.mockImplementation(async (url, config) => {
      if (String(url).endsWith("/sale-context"))
        return { data: { ...catalog, inventories: [catalog.inventories[0]] } };
      switch (config?.params.page) {
        case 1:
          return page([], 1, 3);
        case 2:
          return page([row("item-a", 5, 6)], 2, 3);
        case 3:
          return page([row("item-a", 5, 6), row("item-b", 2, 3, "variant-b")], 3, 3);
        default:
          throw new Error("Unexpected page");
      }
    });
    const items = await fetchInventoryMetrics(request);
    expect(searchCalls().map(([, config]) => config?.params.page)).toEqual([1, 2, 3]);
    expect(items.map((item) => item.inventoryItemId)).toEqual(["item-a", "item-b"]);
    expect(items.reduce((total, item) => total + item.availableStock, 0)).toBe(7);
  });

  it("includes a sales store's linked Shopify warehouse without multiplying shared inventory or including other links", async () => {
    const storeCatalog = {
      ...catalog,
      inventories: [
        ...catalog.inventories,
        { id: "warehouse-own", name: "Local", storeId: "sales-store" },
      ],
    };
    get.mockImplementation(async (url) => {
      if (String(url).endsWith("/sale-context")) return { data: storeCatalog };
      if (String(url).includes("shopify/status"))
        return {
          data: [
            { isConnected: true, store_id: "sales-store", inventory_id: "warehouse-a" },
            { isConnected: true, store_id: "sales-store", inventory_id: "warehouse-a" },
            { isConnected: true, store_id: "other-sales-store", inventory_id: "warehouse-b" },
            { isConnected: false, store_id: "sales-store", inventory_id: "warehouse-b" },
          ],
        };
      return page([]);
    });
    await fetchInventoryMetrics({ ...request, scope: "store", storeIds: ["sales-store"] });
    expect(
      searchCalls()
        .map(([, config]) => config?.params.inventoryId)
        .sort(),
    ).toEqual(["warehouse-a", "warehouse-own"]);
    const shopCall = get.mock.calls.find(([url]) => String(url).includes("shopify/status"));
    expect(shopCall?.[0]).toMatch(/\/shopify\/status\/company-a$/);
    expect(shopCall?.[1]?.headers).toEqual({ Authorization: "Bearer test-token" });
  });

  it.each([
    { ...catalog, companyId: "company-b" },
    {
      ...catalog,
      inventories: [{ id: "foreign-warehouse", name: "Ajeno", storeId: "foreign-store" }],
    },
    { ...catalog, inventoryStoreIds: undefined, stores: {} },
  ])("rejects an invalid or foreign catalog before fetching stock", async (data) => {
    get.mockResolvedValue({ data });
    await expect(fetchInventoryMetrics(request)).rejects.toThrow("Los almacenes no corresponden");
    expect(searchCalls()).toHaveLength(0);
  });

  it("rejects a foreign Shopify inventory link instead of showing empty or partial stock", async () => {
    get.mockResolvedValueOnce({ data: catalog }).mockResolvedValueOnce({
      data: [{ isConnected: true, store_id: "sales-store", inventory_id: "foreign-warehouse" }],
    });
    await expect(
      fetchInventoryMetrics({ ...request, scope: "store", storeIds: ["sales-store"] }),
    ).rejects.toThrow("no pertenece al negocio activo");
    expect(searchCalls()).toHaveLength(0);
  });

  it.each(["catalog", "stock"])(
    "propagates a 401 from %s so it cannot be displayed as zero stock",
    async (source) => {
      const unauthorized = Object.assign(new Error("Unauthorized"), { response: { status: 401 } });
      if (source === "catalog") get.mockRejectedValueOnce(unauthorized);
      else
        get
          .mockResolvedValueOnce({ data: { ...catalog, inventories: [catalog.inventories[0]] } })
          .mockRejectedValueOnce(unauthorized);
      await expect(fetchInventoryMetrics(request)).rejects.toBe(unauthorized);
    },
  );

  it.each([
    { data: [], meta: { page: 1 } },
    { data: [], meta: { page: 2, totalPages: 2 } },
    { data: [row("item-a", " ", 3)], meta: { page: 1, totalPages: 1 } },
  ])(
    "rejects malformed stock metadata or quantities instead of returning partial totals",
    async (data) => {
      get
        .mockResolvedValueOnce({ data: { ...catalog, inventories: [catalog.inventories[0]] } })
        .mockResolvedValueOnce({ data });
      await expect(fetchInventoryMetrics(request)).rejects.toThrow("No se pudo interpretar");
    },
  );

  it("returns an empty result only after a valid empty company inventory catalog", async () => {
    get.mockResolvedValueOnce({ data: { ...catalog, inventories: [] } });
    await expect(fetchInventoryMetrics(request)).resolves.toEqual([]);
    expect(searchCalls()).toHaveLength(0);
  });
});

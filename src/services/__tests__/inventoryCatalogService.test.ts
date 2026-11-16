jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));

import axiosAuth from "@/lib/axiosAuth";
import { fetchScopeInventories } from "../inventoryCatalogService";

const get = jest.mocked(axiosAuth.get);
const storeRequest = {
  companyId: "company-a",
  accessToken: "test-token",
  scope: "store" as const,
  storeIds: ["sales-store"],
};

// "warehouse-main" pertenece a otra tienda: una tienda nueva vinculada al principal de otra.
const warehouses = [
  { id: "warehouse-main", name: "Principal", storeId: "main-store" },
  { id: "warehouse-own", name: "Local", storeId: "sales-store" },
  { id: "warehouse-other", name: "Otro", storeId: "other-store" },
];
function catalog(
  defaultInventoryId?: string | null,
  inventories = warehouses,
  extraStore: Record<string, unknown> = {},
) {
  return {
    companyId: "company-a",
    stores: [
      {
        id: "sales-store",
        name: "Tienda",
        ...(defaultInventoryId === undefined ? {} : { defaultInventoryId }),
        ...extraStore,
      },
      { id: "main-store", name: "Principal" },
      { id: "other-store", name: "Otra" },
    ],
    inventoryStoreIds: ["sales-store", "main-store", "other-store"],
    inventories,
  };
}
function mockResponses(saleContext: unknown, shops: unknown[] = []) {
  get.mockImplementation(async (url) => {
    if (String(url).endsWith("/sale-context")) return { data: saleContext };
    if (String(url).includes("shopify/status")) return { data: shops };
    throw new Error(`Unexpected request ${String(url)}`);
  });
}
const ids = (result: { id: string }[]) => result.map((inventory) => inventory.id);

describe("fetchScopeInventories scope store and the default warehouse", () => {
  beforeEach(() => get.mockReset());

  it("returns the default warehouse of a store without its own warehouse when it belongs to another store", async () => {
    mockResponses(catalog("warehouse-main", [warehouses[0], warehouses[2]]));
    const result = await fetchScopeInventories(storeRequest);
    expect(result).toEqual([
      expect.objectContaining({ id: "warehouse-main", name: "Principal", storeId: "main-store" }),
    ]);
  });

  it("returns both the own warehouse and a different default, keeping the catalog order", async () => {
    mockResponses(catalog("warehouse-main"));
    const result = await fetchScopeInventories(storeRequest);
    expect(ids(result)).toEqual(["warehouse-main", "warehouse-own"]);
  });

  it("lists once a default that is also the warehouse linked to the connected Shopify store", async () => {
    mockResponses(catalog("warehouse-main"), [
      { isConnected: true, store_id: "sales-store", inventory_id: "warehouse-main" },
    ]);
    const result = await fetchScopeInventories(storeRequest);
    expect(ids(result)).toEqual(["warehouse-main", "warehouse-own"]);
  });

  it("lists once a default that is also an own warehouse of the store", async () => {
    mockResponses(catalog("warehouse-own"));
    const result = await fetchScopeInventories(storeRequest);
    expect(ids(result)).toEqual(["warehouse-own"]);
  });

  it("keeps the Shopify warehouse and the default together without touching the Shopify validation", async () => {
    mockResponses(catalog("warehouse-main"), [
      { isConnected: true, store_id: "sales-store", inventory_id: "warehouse-other" },
    ]);
    const result = await fetchScopeInventories(storeRequest);
    expect(ids(result)).toEqual(["warehouse-main", "warehouse-own", "warehouse-other"]);
  });

  it("ignores without error a default that is not in the active company catalog", async () => {
    mockResponses(catalog("warehouse-inactive"));
    const result = await fetchScopeInventories(storeRequest);
    expect(ids(result)).toEqual(["warehouse-own"]);
  });

  it("returns exactly what it returned before when sale-context has no defaultInventoryId (old backend)", async () => {
    mockResponses(catalog(undefined), [
      { isConnected: true, store_id: "sales-store", inventory_id: "warehouse-other" },
    ]);
    const result = await fetchScopeInventories(storeRequest);
    expect(ids(result)).toEqual(["warehouse-own", "warehouse-other"]);
  });

  it("ignores a null default", async () => {
    mockResponses(catalog(null));
    const result = await fetchScopeInventories(storeRequest);
    expect(ids(result)).toEqual(["warehouse-own"]);
  });

  it("ignores a default whose value is not a non-empty string", async () => {
    mockResponses(catalog(undefined, warehouses, { defaultInventoryId: 7 }));
    const result = await fetchScopeInventories(storeRequest);
    expect(ids(result)).toEqual(["warehouse-own"]);
  });

  it("does not pick up the default warehouse of another store", async () => {
    const saleContext = catalog(null);
    saleContext.stores[2] = { ...saleContext.stores[2], defaultInventoryId: "warehouse-main" } as never;
    mockResponses(saleContext);
    const result = await fetchScopeInventories(storeRequest);
    expect(ids(result)).toEqual(["warehouse-own"]);
  });

  it("still rejects a store that is not part of the active company", async () => {
    mockResponses(catalog("warehouse-main"));
    await expect(
      fetchScopeInventories({ ...storeRequest, storeIds: ["foreign-store"] }),
    ).rejects.toThrow("La tienda no corresponde al negocio activo.");
  });

  it("still rejects a Shopify warehouse that is not in the catalog, even with a default", async () => {
    mockResponses(catalog("warehouse-main"), [
      { isConnected: true, store_id: "sales-store", inventory_id: "foreign-warehouse" },
    ]);
    await expect(fetchScopeInventories(storeRequest)).rejects.toThrow(
      "El almacén vinculado a la tienda no pertenece al negocio activo.",
    );
  });
});

describe("fetchScopeInventories scope business", () => {
  beforeEach(() => get.mockReset());

  it("returns the whole company catalog, unaffected by a store default, without asking for Shopify", async () => {
    mockResponses(catalog("warehouse-main"));
    const result = await fetchScopeInventories({ ...storeRequest, scope: "business", storeIds: [] });
    expect(ids(result)).toEqual(["warehouse-main", "warehouse-own", "warehouse-other"]);
    expect(get.mock.calls.some(([url]) => String(url).includes("shopify/status"))).toBe(false);
  });
});

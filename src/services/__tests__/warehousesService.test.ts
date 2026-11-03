import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import {
  createWarehouse,
  deleteWarehouse,
  listWarehouses,
  setMainWarehouse,
  setStoreDefaultWarehouse,
  setWarehouseType,
  type CompanyWarehouse,
} from "../warehousesService";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const BASE = `${GATEWAY.products}/warehouses`;
const WAREHOUSE_ID = "11111111-1111-4111-8111-111111111111";
const STORE_ID = "22222222-2222-4222-8222-222222222222";

const warehouse: CompanyWarehouse = {
  id: WAREHOUSE_ID,
  name: "Almacén central",
  status: true,
  store_id: STORE_ID,
  company_id: "33333333-3333-4333-8333-333333333333",
  type: "PROPIO",
  is_main: true,
};

describe("Servicio de almacenes de la empresa (FEAT-24 H1-A)", () => {
  const initialProductsApi = process.env.NEXT_PUBLIC_API_PRODUCTOS;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NEXT_PUBLIC_API_PRODUCTOS;
  });

  afterAll(() => {
    if (initialProductsApi === undefined) delete process.env.NEXT_PUBLIC_API_PRODUCTOS;
    else process.env.NEXT_PUBLIC_API_PRODUCTOS = initialProductsApi;
  });

  it("lista los almacenes y los vínculos de la empresa con GET /warehouses", async () => {
    const data = {
      warehouses: [warehouse],
      links: [{ store_id: STORE_ID, inventory_id: WAREHOUSE_ID, is_default: true }],
    };
    jest.mocked(axiosAuth.get).mockResolvedValue({ data });
    await expect(listWarehouses()).resolves.toEqual(data);
    expect(axiosAuth.get).toHaveBeenCalledTimes(1);
    expect(axiosAuth.get).toHaveBeenCalledWith(BASE);
  });

  it("crea un almacén con POST /warehouses y no envía ninguna empresa", async () => {
    jest.mocked(axiosAuth.post).mockResolvedValue({ data: warehouse });
    await expect(
      createWarehouse({ name: "Almacén central", storeId: STORE_ID, type: "COURIER" }),
    ).resolves.toEqual(warehouse);
    expect(axiosAuth.post).toHaveBeenCalledWith(BASE, {
      name: "Almacén central",
      storeId: STORE_ID,
      type: "COURIER",
    });

    jest.mocked(axiosAuth.post).mockClear();
    const withStrayCompany = {
      name: "Sin tipo",
      storeId: STORE_ID,
      companyId: "otra-empresa",
    } as Parameters<typeof createWarehouse>[0];
    await createWarehouse(withStrayCompany);
    const body = jest.mocked(axiosAuth.post).mock.calls[0][1];
    expect(body).toEqual({ name: "Sin tipo", storeId: STORE_ID });
    expect(body).not.toHaveProperty("companyId");
    expect(body).not.toHaveProperty("type");
  });

  it("cambia el tipo con PUT /warehouses/:id/type", async () => {
    jest.mocked(axiosAuth.put).mockResolvedValue({ data: { ...warehouse, type: "TIENDA" } });
    await setWarehouseType(WAREHOUSE_ID, "TIENDA");
    expect(axiosAuth.put).toHaveBeenCalledTimes(1);
    expect(axiosAuth.put).toHaveBeenCalledWith(`${BASE}/${WAREHOUSE_ID}/type`, { type: "TIENDA" });
  });

  it("marca el principal con PUT /warehouses/:id/main y sin cuerpo", async () => {
    jest.mocked(axiosAuth.put).mockResolvedValue({ data: warehouse });
    await setMainWarehouse(WAREHOUSE_ID);
    expect(axiosAuth.put).toHaveBeenCalledTimes(1);
    expect(axiosAuth.put).toHaveBeenCalledWith(`${BASE}/${WAREHOUSE_ID}/main`);
  });

  it("fija el almacén por defecto de una tienda con PUT /warehouses/stores/:storeId/default/:inventoryId", async () => {
    jest.mocked(axiosAuth.put).mockResolvedValue({ data: {} });
    await setStoreDefaultWarehouse(STORE_ID, WAREHOUSE_ID);
    expect(axiosAuth.put).toHaveBeenCalledTimes(1);
    expect(axiosAuth.put).toHaveBeenCalledWith(`${BASE}/stores/${STORE_ID}/default/${WAREHOUSE_ID}`);
  });

  it("elimina con DELETE /inventory/:id de logistics, sin cuerpo ni empresa", async () => {
    delete process.env.NEXT_PUBLIC_API_INVENTORY;
    jest.mocked(axiosAuth.delete).mockResolvedValue({ data: {} });
    await deleteWarehouse(WAREHOUSE_ID);
    expect(axiosAuth.delete).toHaveBeenCalledTimes(1);
    expect(axiosAuth.delete).toHaveBeenCalledWith(`${GATEWAY.logistics}/inventory/${WAREHOUSE_ID}`);
    process.env.NEXT_PUBLIC_API_INVENTORY = "https://inventory.example.test";
    await deleteWarehouse(WAREHOUSE_ID);
    expect(axiosAuth.delete).toHaveBeenLastCalledWith(`https://inventory.example.test/inventory/${WAREHOUSE_ID}`);
    delete process.env.NEXT_PUBLIC_API_INVENTORY;
  });

  it("usa la base de productos configurada, igual que /tracking, cuando existe", async () => {
    process.env.NEXT_PUBLIC_API_PRODUCTOS = "https://products.example.test";
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: { warehouses: [], links: [] } });
    await listWarehouses();
    expect(axiosAuth.get).toHaveBeenCalledWith("https://products.example.test/warehouses");
  });

  it("propaga el rechazo del servidor sin ocultarlo", async () => {
    jest.mocked(axiosAuth.put).mockRejectedValue(new Error("Request failed with status code 400"));
    await expect(setWarehouseType(WAREHOUSE_ID, "COURIER")).rejects.toThrow("status code 400");
    jest.mocked(axiosAuth.get).mockRejectedValue(new Error("Unauthorized"));
    await expect(listWarehouses()).rejects.toThrow("Unauthorized");
  });
});

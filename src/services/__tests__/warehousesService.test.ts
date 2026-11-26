import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import {
  createWarehouse,
  deleteWarehouse,
  getInventoryRules,
  getReservationRules,
  listReturnReceptions,
  listWarehouses,
  receiveReturnReception,
  saveInventoryRules,
  saveReservationRules,
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

describe("Reglas de stock y recepciones en /warehouses (FEAT-24 H2-F)", () => {
  const RECEPTION_ID = "44444444-4444-4444-8444-444444444444";

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NEXT_PUBLIC_API_PRODUCTOS;
  });

  it("lee y reemplaza las reglas de reserva sin mandar la empresa", async () => {
    const rules = [{ id: "r", priority: 10, department: "Lima", province: null, storeId: null, inventoryId: WAREHOUSE_ID, active: true }];
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: { rules } });
    await expect(getReservationRules()).resolves.toEqual(rules);
    expect(axiosAuth.get).toHaveBeenCalledWith(`${BASE}/reservation-rules`);

    jest.mocked(axiosAuth.put).mockResolvedValue({ data: { rules } });
    const input = [{ priority: 10, department: "Lima", province: null, storeId: null, inventoryId: WAREHOUSE_ID, active: true }];
    await expect(saveReservationRules(input)).resolves.toEqual(rules);
    expect(axiosAuth.put).toHaveBeenCalledWith(`${BASE}/reservation-rules`, { rules: input });
    expect(jest.mocked(axiosAuth.put).mock.calls[0][1]).not.toHaveProperty("companyId");
  });

  it("una respuesta sin lista se lee como lista vacía", async () => {
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: {} });
    await expect(getReservationRules()).resolves.toEqual([]);
    await expect(listReturnReceptions("por_recibir")).resolves.toEqual([]);
  });

  it("lee y guarda las reglas de inventario", async () => {
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: { releaseAfterDays: null, pickingRequired: false } });
    // FEAT-24 H3: sin las reglas de compras, IGV afecto y sin compra directa a courier.
    await expect(getInventoryRules()).resolves.toEqual({
      releaseAfterDays: null,
      pickingRequired: false,
      igvAffected: true,
      allowPurchaseToCourier: false,
      // FEAT-24 H13 y H5-L: días de cobertura y de aviso de vencimiento, 30 por defecto.
      defaultCoverageDays: 30,
      expiryAlertDays: 30,
      // FEAT-24 C-D3/C-D4: flexible por defecto; sin dato, «por defecto» = nunca.
      stockControl: "flexible",
      defaultReleaseAfterDays: null,
    });
    expect(axiosAuth.get).toHaveBeenCalledWith(`${BASE}/inventory-rules`);

    jest.mocked(axiosAuth.put).mockResolvedValue({ data: { releaseAfterDays: 7, pickingRequired: true } });
    await expect(saveInventoryRules({ releaseAfterDays: 7, pickingRequired: true })).resolves.toEqual({
      releaseAfterDays: 7,
      pickingRequired: true,
      igvAffected: true,
      allowPurchaseToCourier: false,
      defaultCoverageDays: 30,
      expiryAlertDays: 30,
      stockControl: "flexible",
      defaultReleaseAfterDays: null,
    });
    expect(axiosAuth.put).toHaveBeenCalledWith(`${BASE}/inventory-rules`, { releaseAfterDays: 7, pickingRequired: true });
  });

  it("guarda las reglas de compras solo si vienen (FEAT-24 H3)", async () => {
    jest.mocked(axiosAuth.put).mockResolvedValue({
      data: { releaseAfterDays: null, pickingRequired: false, igvAffected: false, allowPurchaseToCourier: true },
    });
    await expect(
      saveInventoryRules({ releaseAfterDays: null, pickingRequired: false, igvAffected: false, allowPurchaseToCourier: true }),
    ).resolves.toEqual({
      releaseAfterDays: null,
      pickingRequired: false,
      igvAffected: false,
      allowPurchaseToCourier: true,
      defaultCoverageDays: 30,
      expiryAlertDays: 30,
      stockControl: "flexible",
      defaultReleaseAfterDays: null,
    });
    expect(axiosAuth.put).toHaveBeenCalledWith(`${BASE}/inventory-rules`, {
      releaseAfterDays: null,
      pickingRequired: false,
      igvAffected: false,
      allowPurchaseToCourier: true,
    });
  });

  it("FEAT-24 H5-L: lee los días de aviso de vencimiento y los manda solo si vienen", async () => {
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: { releaseAfterDays: null, pickingRequired: false, expiryAlertDays: 45 } });
    await expect(getInventoryRules()).resolves.toMatchObject({ expiryAlertDays: 45 });
    jest.mocked(axiosAuth.put).mockResolvedValue({ data: { releaseAfterDays: null, pickingRequired: false, expiryAlertDays: 60 } });
    await expect(saveInventoryRules({ releaseAfterDays: null, pickingRequired: false, expiryAlertDays: 60 })).resolves.toMatchObject({ expiryAlertDays: 60 });
    expect(axiosAuth.put).toHaveBeenLastCalledWith(`${BASE}/inventory-rules`, { releaseAfterDays: null, pickingRequired: false, expiryAlertDays: 60 });
  });

  it("FEAT-24 C-D3/C-D4: lee el control de stock y el vencimiento por defecto; manda stockControl y 0 = nunca", async () => {
    jest.mocked(axiosAuth.get).mockResolvedValue({
      data: { releaseAfterDays: 0, pickingRequired: false, stockControl: "estricto", defaultReleaseAfterDays: 30 },
    });
    await expect(getInventoryRules()).resolves.toMatchObject({
      releaseAfterDays: 0,
      stockControl: "estricto",
      defaultReleaseAfterDays: 30,
    });
    // Un valor raro se lee como flexible / nunca.
    jest.mocked(axiosAuth.get).mockResolvedValue({
      data: { releaseAfterDays: null, pickingRequired: false, stockControl: "otro", defaultReleaseAfterDays: 0 },
    });
    await expect(getInventoryRules()).resolves.toMatchObject({ stockControl: "flexible", defaultReleaseAfterDays: null });

    jest.mocked(axiosAuth.put).mockResolvedValue({ data: { releaseAfterDays: 0, pickingRequired: false, stockControl: "estricto" } });
    await saveInventoryRules({ releaseAfterDays: 0, pickingRequired: false, stockControl: "estricto", defaultReleaseAfterDays: 30 });
    // `defaultReleaseAfterDays` es de solo lectura: no viaja.
    expect(axiosAuth.put).toHaveBeenLastCalledWith(`${BASE}/inventory-rules`, {
      releaseAfterDays: 0,
      pickingRequired: false,
      stockControl: "estricto",
    });
  });

  it("lista las recepciones por estado y recibe una con POST .../receive", async () => {
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: { items: [{ id: RECEPTION_ID }] } });
    await expect(listReturnReceptions("recibida")).resolves.toEqual([{ id: RECEPTION_ID }]);
    expect(axiosAuth.get).toHaveBeenCalledWith(`${BASE}/return-receptions`, { params: { status: "recibida" } });

    const body = { lines: [{ variantId: "v", quantity: 1, result: "reingreso" as const }] };
    jest.mocked(axiosAuth.post).mockResolvedValue({ data: { id: RECEPTION_ID, duplicate: true } });
    await expect(receiveReturnReception(RECEPTION_ID, body)).resolves.toEqual({ id: RECEPTION_ID, duplicate: true });
    expect(axiosAuth.post).toHaveBeenCalledWith(`${BASE}/return-receptions/${RECEPTION_ID}/receive`, body);
  });

  it("propaga el 409 de recibir", async () => {
    jest.mocked(axiosAuth.post).mockRejectedValue(Object.assign(new Error("409"), { response: { status: 409 } }));
    await expect(receiveReturnReception(RECEPTION_ID, { lines: [] })).rejects.toThrow("409");
  });
});

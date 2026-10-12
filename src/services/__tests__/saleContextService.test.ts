jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { fetchSaleContext } from "../saleContextService";

describe("Contexto de venta autorizado", () => {
  beforeEach(() => jest.clearAllMocks());

  it("consulta el endpoint protegido sin enviar una empresa arbitraria", async () => {
    const data = { companyId: "company-a", stores: [], inventories: [] };
    jest.mocked(axiosAuth.get).mockResolvedValue({ data });
    const signal = new AbortController().signal;
    await expect(fetchSaleContext("company-a", signal)).resolves.toEqual(data);
    expect(axiosAuth.get).toHaveBeenCalledWith(`${GATEWAY.ventas}/order-header/sale-context`, { signal });
  });

  it("rechaza una respuesta que pertenece a otra empresa", async () => {
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: { companyId: "company-b", stores: [], inventories: [] } });
    await expect(fetchSaleContext("company-a")).rejects.toThrow("no pertenece a la empresa activa");
  });

  it("propaga el fallo de autorización sin usar un contexto anterior", async () => {
    jest.mocked(axiosAuth.get).mockRejectedValue(new Error("Unauthorized"));
    await expect(fetchSaleContext("company-a")).rejects.toThrow("Unauthorized");
  });

  it("rechaza un contexto incompleto o un almacén sin tienda de la empresa", async () => {
    for (const data of [
      { companyId: "company-a", stores: [] },
      { companyId: "company-a", stores: [{id:"store-a",name:"Tienda A"}], inventories: [{id:"warehouse",name:"Almacén",storeId:"foreign"}] },
    ]) {
      jest.mocked(axiosAuth.get).mockResolvedValue({ data });
      await expect(fetchSaleContext("company-a")).rejects.toThrow("No se pudo cargar");
    }
  });

  it("permite un almacén de una tienda heredada autorizada sin ofrecerla como tienda de venta", async () => {
    const data = {
      companyId: "company-a",
      stores: [{ id: "commercial", name: "Tienda comercial" }],
      inventories: [{ id: "warehouse", name: "Almacén central", storeId: "legacy" }],
      inventoryStoreIds: ["commercial", "legacy"],
    };
    jest.mocked(axiosAuth.get).mockResolvedValue({ data });

    await expect(fetchSaleContext("company-a")).resolves.toEqual(data);
  });

  it("rechaza un almacén ajeno a los propietarios autorizados aunque existan tiendas de venta", async () => {
    jest.mocked(axiosAuth.get).mockResolvedValue({
      data: {
        companyId: "company-a",
        stores: [{ id: "commercial", name: "Tienda comercial" }],
        inventories: [{ id: "warehouse", name: "Almacén", storeId: "foreign" }],
        inventoryStoreIds: ["commercial", "legacy"],
      },
    });

    await expect(fetchSaleContext("company-a")).rejects.toThrow("No se pudo cargar");
  });

  it("rechaza propietarios de almacén malformados sin recurrir a las tiendas visibles", async () => {
    for (const inventoryStoreIds of [null, "commercial", [null], [1], [""]]) {
      jest.mocked(axiosAuth.get).mockResolvedValue({
        data: {
          companyId: "company-a",
          stores: [{ id: "commercial", name: "Tienda comercial" }],
          inventories: [{ id: "warehouse", name: "Almacén", storeId: "commercial" }],
          inventoryStoreIds,
        },
      });

      await expect(fetchSaleContext("company-a")).rejects.toThrow("No se pudo cargar");
    }
  });

  it("conserva la compatibilidad con el contexto anterior sin propietarios separados", async () => {
    const data = {
      companyId: "company-a",
      stores: [{ id: "commercial", name: "Tienda comercial" }],
      inventories: [{ id: "warehouse", name: "Almacén", storeId: "commercial" }],
    };
    jest.mocked(axiosAuth.get).mockResolvedValue({ data });

    await expect(fetchSaleContext("company-a")).resolves.toEqual(data);
  });
});

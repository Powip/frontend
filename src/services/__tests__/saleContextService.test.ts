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
});

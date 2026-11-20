import axiosAuth from "@/lib/axiosAuth";
import { getOrderById, getOrdersByCompany, getSellerSummary, updateOrderHeader } from "../Ventas";

// FEAT-24 SEC: ms-ventas pide el JWT de la empresa en `order-header`; estas llamadas van con la sesión (axiosAuth).
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn() } }));
jest.mock("@/lib/api", () => ({ API: { ventas: "http://ventas" } }));

const authGet = jest.mocked(axiosAuth.get);
const authPatch = jest.mocked(axiosAuth.patch);
beforeEach(() => jest.clearAllMocks());

test("los pedidos de la empresa, el resumen por vendedor y el detalle se leen con la sesión", async () => {
  authGet.mockResolvedValue({ data: [] });
  await getOrdersByCompany("company-1", "2026-11-01", "2026-11-18");
  await getSellerSummary("company-1");
  await getOrderById("order-1");
  expect(authGet).toHaveBeenCalledWith("http://ventas/order-header/company/company-1", {
    params: { fromDate: "2026-11-01", toDate: "2026-11-18" },
  });
  expect(authGet).toHaveBeenCalledWith("http://ventas/order-header/summary/company/company-1/sellers");
  expect(authGet).toHaveBeenCalledWith("http://ventas/order-header/order-1");
});

test("editar la cabecera va con la sesión", async () => {
  authPatch.mockResolvedValue({ data: { id: "order-1" } });
  await expect(updateOrderHeader("order-1", { notes: "x" } as never)).resolves.toEqual({ id: "order-1" });
  expect(authPatch).toHaveBeenCalledWith("http://ventas/order-header/order-1", { notes: "x" });
});

import axiosAuth from "@/lib/axiosAuth";
import {
  changeReservationWarehouse,
  completePicking,
  confirmPickingLine,
  getPicking,
  getStockTray,
  handleOutOfStockOrder,
  markCourierReturn,
  releaseReservation,
  scanPicking,
} from "../orderStockService";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

const API = "https://ventas.test";

describe("servicio de stock de pedidos (FEAT-24 H2-F)", () => {
  const previous = process.env.NEXT_PUBLIC_API_VENTAS;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_API_VENTAS = API;
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: { ok: "get" } });
    jest.mocked(axiosAuth.post).mockResolvedValue({ data: { ok: "post" } });
    jest.mocked(axiosAuth.patch).mockResolvedValue({ data: { ok: "patch" } });
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_API_VENTAS = previous;
  });

  it("pide las bandejas con limit y offset", async () => {
    await getStockTray("sin-stock", { limit: 50, offset: 100 });
    expect(axiosAuth.get).toHaveBeenCalledWith(`${API}/order-header/stock-trays/sin-stock`, { params: { limit: 50, offset: 100 } });
    await getStockTray("sin-reserva", { limit: 10, offset: 0 });
    expect(axiosAuth.get).toHaveBeenLastCalledWith(`${API}/order-header/stock-trays/sin-reserva`, { params: { limit: 10, offset: 0 } });
  });

  it("gestiona, libera, devuelve y cambia el almacén", async () => {
    await expect(handleOutOfStockOrder("o-1", "espera")).resolves.toEqual({ ok: "post" });
    expect(axiosAuth.post).toHaveBeenCalledWith(`${API}/order-header/o-1/stock-handling`, { action: "espera" });
    await releaseReservation("o-1", "Cliente pidió esperar");
    expect(axiosAuth.post).toHaveBeenLastCalledWith(`${API}/order-header/o-1/release-reservation`, { reason: "Cliente pidió esperar" });
    await markCourierReturn("o-1");
    expect(axiosAuth.post).toHaveBeenLastCalledWith(`${API}/order-header/o-1/courier-return`, {});
    await markCourierReturn("o-1", "  caja rota ");
    expect(axiosAuth.post).toHaveBeenLastCalledWith(`${API}/order-header/o-1/courier-return`, { note: "caja rota" });
    await expect(changeReservationWarehouse("o-1", "inv-2")).resolves.toEqual({ ok: "patch" });
    expect(axiosAuth.patch).toHaveBeenCalledWith(`${API}/order-header/o-1/stock-warehouse`, { inventoryId: "inv-2" });
  });

  it("habla con el picking del pedido", async () => {
    await getPicking("o-1");
    expect(axiosAuth.get).toHaveBeenCalledWith(`${API}/order-header/o-1/picking`);
    await scanPicking("o-1", "7750000000001");
    expect(axiosAuth.post).toHaveBeenCalledWith(`${API}/order-header/o-1/picking/scan`, { code: "7750000000001" });
    await confirmPickingLine("o-1", "item-1");
    expect(axiosAuth.post).toHaveBeenLastCalledWith(`${API}/order-header/o-1/picking/confirm-line`, { itemId: "item-1" });
    await completePicking("o-1");
    expect(axiosAuth.post).toHaveBeenLastCalledWith(`${API}/order-header/o-1/picking/complete`, {});
  });

  it("propaga los errores del servidor", async () => {
    jest.mocked(axiosAuth.post).mockRejectedValueOnce({ response: { status: 409, data: { message: "Faltan productos" } } });
    await expect(completePicking("o-1")).rejects.toMatchObject({ response: { status: 409 } });
  });
});

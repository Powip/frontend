import axiosAuth from "@/lib/axiosAuth";
import {
  confirmarVentaCc,
  getCcOrderConfirmationCapabilities,
} from "../atencionClienteService";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const BASE = `${process.env.NEXT_PUBLIC_API_VENTAS}/atencion-al-cliente/pedidos`;

beforeEach(() => jest.resetAllMocks());

it("checks the permission for this CC order without activating a sale", async () => {
  const capabilities = { enabled: true, canConfirm: true };
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: capabilities });
  await expect(getCcOrderConfirmationCapabilities("order/a ?")).resolves.toBe(capabilities);
  expect(axiosAuth.get).toHaveBeenCalledWith(`${BASE}/order%2Fa%20%3F/confirmation-capabilities`);
  expect(axiosAuth.post).not.toHaveBeenCalled();
});

it("uses the CC command and preserves the reviewed snapshot on a retry", async () => {
  const command = {
    commandId: "b404de86-f047-457f-ac0d-c876a8e4af23",
    leadId: "lead-1",
    expectedOrderUpdatedAt: "2026-10-22T22:00:00.000Z",
  };
  const result = { lead: { id: "lead-1" }, order: { id: "order-1" }, replayed: true };
  jest.mocked(axiosAuth.post)
    .mockRejectedValueOnce(new Error("Respuesta interrumpida"))
    .mockResolvedValueOnce({ data: result });
  await expect(confirmarVentaCc("order/1", command)).rejects.toThrow("Respuesta interrumpida");
  await expect(confirmarVentaCc("order/1", command)).resolves.toBe(result);
  expect(axiosAuth.post).toHaveBeenNthCalledWith(1, `${BASE}/order%2F1/confirmar-venta`, command);
  expect(axiosAuth.post).toHaveBeenNthCalledWith(2, `${BASE}/order%2F1/confirmar-venta`, command);
  expect(axiosAuth.get).not.toHaveBeenCalled();
});

it("preserves a permission rejection without falling back to another confirmation route", async () => {
  const failure = { response: { status: 403 } };
  jest.mocked(axiosAuth.post).mockRejectedValue(failure);
  await expect(confirmarVentaCc("order-1", { commandId: "b404de86-f047-457f-ac0d-c876a8e4af23" })).rejects.toBe(failure);
  expect(axiosAuth.post).toHaveBeenCalledTimes(1);
});

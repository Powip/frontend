import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { processBulkStatusChange } from "../bulkStatusUtils";

jest.mock("axios", () => ({ __esModule: true, default: { patch: jest.fn() } }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { patch: jest.fn() } }));
const publicPatch = jest.mocked(axios.patch);
const authPatch = jest.mocked(axiosAuth.patch);
beforeEach(() => jest.clearAllMocks());

test("mixed bulk leaves normal IDs on the original endpoint and sends tracked IDs individually with auth", async () => {
  publicPatch.mockResolvedValue({ data: { updated: ["normal"], skipped: [] } });
  authPatch.mockResolvedValue({ data: {} });
  const result = await processBulkStatusChange(["normal", "tracked"], "PREPARADO", "http://ventas", undefined, 10, undefined, undefined, undefined, new Set(["tracked"]));
  expect(publicPatch).toHaveBeenCalledWith("http://ventas/order-header/bulk-status", { ids: ["normal"], status: "PREPARADO" });
  expect(authPatch).toHaveBeenCalledWith("http://ventas/order-header/manual/tracked/status", { status: "PREPARADO" });
  expect(result).toEqual({ success: ["normal", "tracked"], failed: [] });
});

test("a rejected tracked transition remains failed and never falls back to the public endpoint", async () => {
  authPatch.mockRejectedValue({ response: { status: 409, data: { message: "La reserva sigue pendiente" } } });
  const result = await processBulkStatusChange(["tracked"], "ENTREGADO", "http://ventas", undefined, 10, undefined, undefined, undefined, new Set(["tracked"]));
  expect(publicPatch).not.toHaveBeenCalled();
  expect(result).toEqual({ success: [], failed: [{ id: "tracked", error: "La reserva sigue pendiente" }] });
});

test("tracked rescheduling uses the authenticated route without adding a status", async () => {
  authPatch.mockResolvedValue({ data: {} });
  await processBulkStatusChange(["tracked"], undefined, "http://ventas", undefined, 10, undefined, "SCHEDULED", "2026-10-18", new Set(["tracked"]));
  expect(authPatch).toHaveBeenCalledWith("http://ventas/order-header/manual/tracked/status", { callStatus: "SCHEDULED", callbackAt: "2026-10-18" });
  expect(publicPatch).not.toHaveBeenCalled();
});

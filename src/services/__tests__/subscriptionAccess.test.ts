import axios from "axios";
import { GATEWAY } from "@/lib/gateway";
import { ACCESS_TIMEOUT_MS, fetchSubscriptionAccess } from "../subscriptionAccess";

jest.mock("axios");

beforeEach(() => {
  jest.mocked(axios.get).mockReset();
});

it("lee el estado de acceso de la empresa con el token de la sesión y un timeout de 5 s", async () => {
  jest.mocked(axios.get).mockResolvedValueOnce({
    data: { state: "AVISO", deadline: "2026-10-23", firstChargeDate: null, owner: true },
  });

  await expect(fetchSubscriptionAccess("fixture-token")).resolves.toEqual({
    state: "AVISO",
    deadline: "2026-10-23",
    firstChargeDate: null,
    owner: true,
  });
  expect(ACCESS_TIMEOUT_MS).toBe(5000);
  expect(axios.get).toHaveBeenCalledWith(`${GATEWAY.subscription}/subscriptions/access`, {
    headers: { Authorization: "Bearer fixture-token" },
    timeout: 5000,
  });
});

it("un error del servidor se toma como sin dato (la app deja entrar)", async () => {
  jest.mocked(axios.get).mockRejectedValueOnce(new Error("Request failed with status code 500"));

  await expect(fetchSubscriptionAccess("fixture-token")).resolves.toBeNull();
});

it("un timeout se toma como sin dato", async () => {
  jest.mocked(axios.get).mockRejectedValueOnce(Object.assign(new Error("timeout of 5000ms exceeded"), { code: "ECONNABORTED" }));

  await expect(fetchSubscriptionAccess("fixture-token")).resolves.toBeNull();
});

it.each([
  [{ state: "RARO", deadline: null, firstChargeDate: null, owner: true }],
  [{ state: "OK", deadline: null, firstChargeDate: null }],
  [{ state: "AVISO", deadline: 23, firstChargeDate: null, owner: true }],
  [null],
  ["<html>gateway</html>"],
])("una respuesta con otra forma se descarta: %p", async (data) => {
  jest.mocked(axios.get).mockResolvedValueOnce({ data });

  await expect(fetchSubscriptionAccess("fixture-token")).resolves.toBeNull();
});

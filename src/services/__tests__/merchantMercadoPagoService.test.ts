import axiosAuth from "@/lib/axiosAuth";
import {
  connectMerchantMercadoPago,
  disconnectMerchantMercadoPago,
  getMerchantMercadoPagoConnection,
} from "../merchantMercadoPagoService";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
const STORE = "11111111-1111-4111-8111-111111111111";
const signal = new AbortController().signal;
const AUTHORIZATION = `https://auth.mercadopago.com/authorization?state=${"a".repeat(43)}`;
const get = jest.mocked(axiosAuth.get);
const post = jest.mocked(axiosAuth.post);
beforeEach(() => {
  jest.clearAllMocks();
});

test("starts production OAuth through the same-origin proxy with bearer, nonce cookies and cancellation", async () => {
  post.mockResolvedValue({ data: { authorizationUrl: AUTHORIZATION } });
  await expect(connectMerchantMercadoPago(STORE, "synthetic-bearer", signal)).resolves.toBe(
    AUTHORIZATION,
  );
  expect(post).toHaveBeenCalledWith(
    `/api/merchant-payments/stores/${STORE}/mercadopago/connect`,
    { mode: "production" },
    expect.objectContaining({
      headers: { Authorization: "Bearer synthetic-bearer" },
      signal,
      withCredentials: true,
    }),
  );
});

test.each([
  "javascript:alert(1)",
  "https://evil.example/authorization",
  `https://auth.mercadopago.com/authorization?state=${"a".repeat(43)}&state=extra`,
])("does not pass an unsafe OAuth redirect to the caller: %s", async (authorizationUrl) => {
  post.mockResolvedValue({ data: { authorizationUrl } });
  await expect(connectMerchantMercadoPago(STORE, "token", signal)).rejects.toThrow("Autorización");
});

test("connection metadata is projected to public fields only", async () => {
  get.mockResolvedValue({
    data: {
      connected: true,
      canManage: false,
      oauthReady: true,
      mode: "production",
      collectorId: "123",
      accountLabel: "Negocio",
      connectionType: "oauth",
      accessToken: "unexpected-secret",
    },
  });
  const result = await getMerchantMercadoPagoConnection(STORE, "token", signal);
  expect(result).toMatchObject({ connected: true, collectorId: "123", canManage: false });
  expect(result).not.toHaveProperty("accessToken");
  expect(get).toHaveBeenCalledWith(
    expect.stringContaining(`/merchant-payments/stores/${STORE}/mercadopago/connection`),
    expect.objectContaining({ signal }),
  );
});

test("malformed metadata cannot enable account management", async () => {
  get.mockResolvedValue({
    data: { connected: "true", canManage: true, oauthReady: true, mode: "production" },
  });
  await expect(getMerchantMercadoPagoConnection(STORE, "token", signal)).rejects.toThrow(
    "Estado de conexión",
  );
  for (const account of [
    {},
    { collectorId: "123" },
    { collectorId: "123", connectionType: "server" },
  ]) {
    get.mockResolvedValue({
      data: { connected: true, canManage: true, oauthReady: true, mode: "production", ...account },
    });
    await expect(getMerchantMercadoPagoConnection(STORE, "token", signal)).rejects.toThrow(
      "Estado de conexión",
    );
  }
});

test("disconnect stays on the administrative route and invalid store IDs never reach the API", async () => {
  post.mockResolvedValue({ data: {} });
  await disconnectMerchantMercadoPago(STORE, "token", signal);
  expect(post).toHaveBeenCalledWith(
    expect.stringContaining(`/merchant-payments/stores/${STORE}/mercadopago/disconnect`),
    {},
    expect.objectContaining({ signal }),
  );
  await expect(connectMerchantMercadoPago("../other", "token", signal)).rejects.toThrow(
    "tienda válida",
  );
  expect(post).toHaveBeenCalledTimes(1);
});

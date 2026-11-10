import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  connectMerchantMercadoPago,
  disconnectMerchantMercadoPago,
  getMerchantMercadoPagoConnection,
  openMerchantMercadoPagoAuthorization,
} from "@/services/merchantMercadoPagoService";
import MerchantMercadoPagoSettings from "../MerchantMercadoPagoSettings";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
let query = new URLSearchParams();
jest.mock("next/navigation", () => ({ useSearchParams: () => query }));
jest.mock("@/services/merchantMercadoPagoService", () => ({
  ...jest.requireActual("@/services/merchantMercadoPagoService"),
  getMerchantMercadoPagoConnection: jest.fn(),
  connectMerchantMercadoPago: jest.fn(),
  disconnectMerchantMercadoPago: jest.fn(),
  openMerchantMercadoPagoAuthorization: jest.fn(),
}));
const STORE_A = "11111111-1111-4111-8111-111111111111";
const STORE_B = "22222222-2222-4222-8222-222222222222";
const authorizationUrl = `https://auth.mercadopago.com/authorization?state=${"a".repeat(43)}`;
const disconnected = {
  connected: false,
  mode: "production" as const,
  canManage: true,
  oauthReady: true,
};
const connected = {
  ...disconnected,
  connected: true,
  collectorId: "987654321",
  accountLabel: "Universo Anime Perú",
  connectionType: "oauth" as const,
};
const getConnection = jest.mocked(getMerchantMercadoPagoConnection);
const connect = jest.mocked(connectMerchantMercadoPago);
const disconnect = jest.mocked(disconnectMerchantMercadoPago);
const openAuthorization = jest.mocked(openMerchantMercadoPagoAuthorization);
let token = "synthetic-access-token";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  jest.clearAllMocks();
  query = new URLSearchParams();
  token = "synthetic-access-token";
  jest.mocked(useAuth).mockImplementation(
    () =>
      ({
        loading: false,
        selectedStoreId: STORE_A,
        auth: {
          accessToken: token,
          user: { id: "actor" },
          company: {
            id: "company",
            stores: [
              { id: STORE_A, name: "Tienda principal" },
              { id: STORE_B, name: "Tienda secundaria" },
            ],
          },
        },
      }) as unknown as ReturnType<typeof useAuth>,
  );
  getConnection.mockResolvedValue(disconnected);
  connect.mockResolvedValue(authorizationUrl);
  disconnect.mockResolvedValue(undefined);
});

test("uses existing company stores and opens only production OAuth without credential inputs", async () => {
  const user = userEvent.setup();
  render(<MerchantMercadoPagoSettings />);
  expect(screen.getByRole("combobox", { name: "Tienda" })).toHaveValue(STORE_A);
  await user.click(await screen.findByRole("button", { name: "Conectar Mercado Pago" }));
  expect(connect).toHaveBeenCalledWith(STORE_A, token, expect.any(AbortSignal));
  expect(openAuthorization).toHaveBeenCalledWith(authorizationUrl);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(document.querySelector('input[type="password"]')).toBeNull();
});

test("callback success hint is untrusted until metadata confirms this store", async () => {
  query = new URLSearchParams({ mp: "connected", storeId: STORE_A });
  const pending = deferred<typeof connected>();
  getConnection.mockReturnValue(pending.promise);
  render(<MerchantMercadoPagoSettings />);
  expect(screen.queryByText(/La cuenta figura conectada/)).not.toBeInTheDocument();
  await act(async () => pending.resolve(connected));
  expect(screen.getByText(/La cuenta figura conectada/)).toBeInTheDocument();
  expect(screen.getByText("987654321")).toBeInTheDocument();
  expect(screen.getByText("Universo Anime Perú")).toBeInTheDocument();
});

test("does not claim success when callback hint returns a disconnected account", async () => {
  query = new URLSearchParams({ mp: "connected", storeId: STORE_A });
  render(<MerchantMercadoPagoSettings />);
  expect(await screen.findByText("Sin cuenta conectada")).toBeInTheDocument();
  expect(screen.queryByText(/La cuenta figura conectada/)).not.toBeInTheDocument();
});

test("callback store selection is restricted to stores in the current company", async () => {
  query = new URLSearchParams({ mp: "connected", storeId: "33333333-3333-4333-8333-333333333333" });
  render(<MerchantMercadoPagoSettings />);
  await screen.findByText("Sin cuenta conectada");
  expect(getConnection).toHaveBeenCalledWith(STORE_A, token, expect.any(AbortSignal));
  expect(screen.queryByText(/La cuenta figura conectada/)).not.toBeInTheDocument();
});

test("hides write actions when backend denies management, regardless of UI role", async () => {
  getConnection.mockResolvedValue({ ...connected, canManage: false });
  render(<MerchantMercadoPagoSettings />);
  await screen.findByText("Cuenta conectada");
  expect(screen.queryByRole("button", { name: /Conectar|Desconectar/ })).not.toBeInTheDocument();
});

test("disables connection while server OAuth is unavailable", async () => {
  getConnection.mockResolvedValue({ ...disconnected, oauthReady: false });
  render(<MerchantMercadoPagoSettings />);
  expect(await screen.findByRole("button", { name: "Conectar Mercado Pago" })).toBeDisabled();
  expect(screen.getByText(/POWIP complete la configuración/)).toBeInTheDocument();
});

test("disconnect re-reads metadata and explains remaining provider revocation", async () => {
  getConnection
    .mockResolvedValueOnce(connected)
    .mockResolvedValueOnce({ ...disconnected, revocationRequired: true });
  render(<MerchantMercadoPagoSettings />);
  await userEvent.click(await screen.findByRole("button", { name: "Desconectar" }));
  expect(await screen.findByText("Sin cuenta conectada")).toBeInTheDocument();
  expect(disconnect).toHaveBeenCalledWith(STORE_A, token, expect.any(AbortSignal));
  expect(getConnection).toHaveBeenCalledTimes(2);
  expect(screen.getByText(/retirar la autorización desde tu cuenta/)).toBeInTheDocument();
});

test("does not double-submit connection before the busy state is rendered", async () => {
  const pending = deferred<string>();
  connect.mockReturnValue(pending.promise);
  render(<MerchantMercadoPagoSettings />);
  const button = await screen.findByRole("button", { name: "Conectar Mercado Pago" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(connect).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve(authorizationUrl));
});

test("cancels old store requests and ignores a late OAuth redirect after selecting another store", async () => {
  const pending = deferred<string>();
  connect.mockReturnValue(pending.promise);
  render(<MerchantMercadoPagoSettings />);
  await userEvent.click(await screen.findByRole("button", { name: "Conectar Mercado Pago" }));
  const oldSignal = connect.mock.calls[0][2];
  await userEvent.selectOptions(screen.getByLabelText("Tienda"), STORE_B);
  await screen.findByRole("region", { name: "Cuenta de Mercado Pago de Tienda secundaria" });
  expect(oldSignal.aborted).toBe(true);
  await act(async () => pending.resolve(authorizationUrl));
  expect(openAuthorization).not.toHaveBeenCalled();
  expect(getConnection).toHaveBeenLastCalledWith(STORE_B, token, expect.any(AbortSignal));
});

test("late metadata from the previous store cannot reveal its account in the new store", async () => {
  const pending = deferred<typeof connected>();
  getConnection.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(disconnected);
  render(<MerchantMercadoPagoSettings />);
  await userEvent.selectOptions(screen.getByLabelText("Tienda"), STORE_B);
  await screen.findByText("Sin cuenta conectada");
  await act(async () => pending.resolve(connected));
  expect(screen.queryByText("987654321")).not.toBeInTheDocument();
});

test("session changes invalidate the previous operation and reload current authorization", async () => {
  const pending = deferred<string>();
  connect.mockReturnValue(pending.promise);
  const rendered = render(<MerchantMercadoPagoSettings />);
  await userEvent.click(await screen.findByRole("button", { name: "Conectar Mercado Pago" }));
  token = "new-synthetic-session";
  getConnection.mockResolvedValue({ ...disconnected, canManage: false });
  rendered.rerender(<MerchantMercadoPagoSettings />);
  await screen.findByText(/El administrador de la empresa/);
  await act(async () => pending.resolve(authorizationUrl));
  expect(openAuthorization).not.toHaveBeenCalled();
});

test("renders actionable errors without echoing provider payloads and retries metadata", async () => {
  getConnection.mockRejectedValueOnce({
    response: { status: 503, data: { message: "access_token=secret" } },
  });
  render(<MerchantMercadoPagoSettings />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/aún no está disponible/);
  expect(document.body).not.toHaveTextContent("secret");
  await userEvent.click(screen.getByRole("button", { name: "Volver a consultar" }));
  await waitFor(() => expect(screen.getByText("Sin cuenta conectada")).toBeInTheDocument());
});

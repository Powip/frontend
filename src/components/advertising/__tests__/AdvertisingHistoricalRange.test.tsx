import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { StrictMode } from "react";
import type {
  AdvertisingAccountWire,
  AdvertisingSnapshotWire,
} from "@/services/advertisingService";
import { AdvertisingLivePanel } from "../AdvertisingLivePanel";

jest.mock("axios");

const get = jest.mocked(axios.get);
const put = jest.mocked(axios.put);
const post = jest.mocked(axios.post);
const BASE = "https://integrations.example.test";
const COMPANY_ID = "b2222222-2222-4222-8222-222222222222";
const ACTOR_ID = "a1111111-1111-4111-8111-111111111111";
const TOKEN = "test-access-token";
const ROOT = `${BASE}/advertising/companies/${COMPANY_ID}`;
const TODAY = "2026-10-10";
const previousBase = process.env.NEXT_PUBLIC_API_INTEGRATIONS;
let accounts: AdvertisingAccountWire[];
let canManage: boolean;
let providerStatus: AdvertisingSnapshotWire["providers"]["meta"]["status"];
let queryClients: QueryClient[];

function account(
  syncFrom: string | null = "2026-10-01",
  id = "account-id",
): AdvertisingAccountWire {
  return {
    id,
    provider: "meta",
    externalId: id === "account-id" ? "123" : "456",
    name: id === "account-id" ? "Cuenta Lima" : "Cuenta histórica",
    currency: "PEN",
    timeZone: "America/Lima",
    enabled: true,
    connectionId: "connection-id",
    syncFrom,
    lastAttemptAt: null,
    lastSuccessfulAt: null,
    updatedAt: null,
  };
}

function snapshot(): AdvertisingSnapshotWire {
  return {
    accounts: accounts.map((item) => ({ ...item })),
    days: [],
    manualRecords: [],
    providers: {
      meta: { available: true, status: providerStatus },
      tiktok: { available: false, status: "disconnected" },
    },
    capabilities: { canManage, canReconcile: false },
    today: TODAY,
  };
}

function renderPanel(from: string, to: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  queryClients.push(client);
  return render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <AdvertisingLivePanel
          companyId={COMPANY_ID}
          actorId={ACTOR_ID}
          token={TOKEN}
          companyName="Empresa de prueba"
          from={from}
          to={to}
          connectionsOnly
        />
      </QueryClientProvider>
    </StrictMode>,
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  window.history.replaceState(null, "", "/configuracion/integraciones/publicidad");
  process.env.NEXT_PUBLIC_API_INTEGRATIONS = BASE;
  accounts = [account()];
  canManage = true;
  providerStatus = "connected";
  queryClients = [];
  get.mockImplementation(async (url) => {
    if (url === `${ROOT}/snapshot`) return { data: snapshot() };
    if (url === `${ROOT}/meta/accounts`)
      return {
        data: {
          accounts: accounts.map(({ externalId, name, currency, timeZone }) => ({
            externalId,
            name,
            currency,
            timeZone,
          })),
        },
      };
    throw new Error(`Unexpected fixture GET: ${url}`);
  });
  put.mockImplementation(async (url, payload) => {
    if (url !== `${ROOT}/meta/accounts`) throw new Error(`Unexpected fixture PUT: ${url}`);
    const selection = payload as { externalIds: string[]; syncFrom?: string };
    accounts = accounts.map((item) => ({
      ...item,
      enabled: selection.externalIds.includes(item.externalId),
      syncFrom:
        selection.syncFrom && (!item.syncFrom || selection.syncFrom < item.syncFrom)
          ? selection.syncFrom
          : item.syncFrom,
    }));
    return { data: { selectedCount: selection.externalIds.length } };
  });
  post.mockImplementation(async (url, payload) => {
    if (url !== `${ROOT}/meta/sync`) throw new Error(`Unexpected fixture POST: ${url}`);
    const period = payload as { from: string; to: string };
    return {
      data: {
        runs: accounts
          .filter((item) => item.enabled && (!item.syncFrom || item.syncFrom <= period.to))
          .map((item) => ({
            accountId: item.id,
            from: item.syncFrom && item.syncFrom > period.from ? item.syncFrom : period.from,
            to: period.to,
            status: "succeeded",
          })),
      },
    };
  });
});

afterEach(() => {
  cleanup();
  for (const client of queryClients) client.clear();
});

afterAll(() => {
  if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_INTEGRATIONS;
  else process.env.NEXT_PUBLIC_API_INTEGRATIONS = previousBase;
});

describe("advertising historical import flow", () => {
  it.each([
    { from: "2026-10-01", to: TODAY, chosen: "2026-09-01", expectedTo: TODAY },
    {
      from: "2026-09-01",
      to: "2026-09-30",
      chosen: "2026-08-15",
      expectedTo: "2026-09-30",
    },
    { from: "2026-10-01", to: "2026-10-31", chosen: "2026-09-01", expectedTo: TODAY },
  ])(
    "imports the reviewed start $chosen through $expectedTo",
    async ({ from, to, chosen, expectedTo }) => {
      const user = userEvent.setup();
      renderPanel(from, to);
      await user.click(await screen.findByRole("button", { name: "Elegir cuentas" }));
      expect(await screen.findByRole("checkbox", { name: /Cuenta Lima/ })).toBeChecked();
      fireEvent.change(screen.getByLabelText("Consultar desde"), { target: { value: chosen } });
      await user.click(screen.getByRole("button", { name: "Continuar con 1 cuenta" }));
      expect(screen.getByText(`Consultar desde ${chosen}.`)).toBeVisible();
      expect(put).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Guardar cuentas" }));
      await screen.findByText("Datos actualizados.");
      expect(put).toHaveBeenCalledTimes(1);
      expect(put).toHaveBeenCalledWith(
        `${ROOT}/meta/accounts`,
        { externalIds: ["123"], syncFrom: chosen },
        expect.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } }),
      );
      expect(post).toHaveBeenCalledTimes(1);
      expect(post).toHaveBeenCalledWith(
        `${ROOT}/meta/sync`,
        { from: chosen, to: expectedTo },
        expect.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } }),
      );
      expect(put.mock.invocationCallOrder[0]).toBeLessThan(post.mock.invocationCallOrder[0]);
      await waitFor(() =>
        expect(get.mock.calls.filter(([url]) => url === `${ROOT}/snapshot`).length).toBeGreaterThan(
          1,
        ),
      );
    },
  );

  it("saves without importing when the reviewed start is after the displayed end", async () => {
    const user = userEvent.setup();
    renderPanel("2026-09-01", "2026-09-30");
    await user.click(await screen.findByRole("button", { name: "Elegir cuentas" }));
    await screen.findByRole("checkbox", { name: /Cuenta Lima/ });
    fireEvent.change(screen.getByLabelText("Consultar desde"), { target: { value: "2026-10-01" } });
    await user.click(screen.getByRole("button", { name: "Continuar con 1 cuenta" }));
    await user.click(screen.getByRole("button", { name: "Guardar cuentas" }));
    await screen.findByText("Cuentas guardadas.");
    expect(put).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
  });

  it("keeps imports stopped when the user explicitly removes the selected account", async () => {
    const user = userEvent.setup();
    renderPanel("2026-10-01", TODAY);
    await user.click(await screen.findByRole("button", { name: "Elegir cuentas" }));
    await user.click(await screen.findByRole("checkbox", { name: /Cuenta Lima/ }));
    await user.click(screen.getByRole("button", { name: "Continuar con 0 cuentas" }));
    expect(screen.getByText("Las cuentas dejarán de actualizarse.")).toBeVisible();
    expect(put).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Guardar cuentas" }));
    await screen.findByText("Cuentas guardadas.");
    expect(put).toHaveBeenCalledWith(
      `${ROOT}/meta/accounts`,
      { externalIds: [], syncFrom: "2026-10-01" },
      expect.any(Object),
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("explains a period before every active account's import start without sending a sync", async () => {
    const user = userEvent.setup();
    renderPanel("2026-09-01", "2026-09-30");
    await user.click(await screen.findByRole("button", { name: "Actualizar gasto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este periodo es anterior a «Consultar desde». Cambia la fecha en Elegir cuentas.",
    );
    expect(post).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(screen.queryByText("No hay cuentas activas para actualizar.")).not.toBeInTheDocument();
  });

  it.each(["2026-10-01", null])(
    "refreshes eligible accounts with import start %s without extending today's boundary",
    async (syncFrom) => {
      const user = userEvent.setup();
      accounts = [account(syncFrom)];
      renderPanel("2026-10-01", "2026-10-31");
      await user.click(await screen.findByRole("button", { name: "Actualizar gasto" }));
      await screen.findByText("Datos actualizados.");
      expect(post).toHaveBeenCalledTimes(1);
      expect(post).toHaveBeenCalledWith(
        `${ROOT}/meta/sync`,
        { from: "2026-10-01", to: TODAY },
        expect.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } }),
      );
      expect(put).not.toHaveBeenCalled();
    },
  );

  it("refreshes a historical account even when another active account starts after the period", async () => {
    const user = userEvent.setup();
    accounts = [account(), account("2026-09-01", "historical-account")];
    renderPanel("2026-09-01", "2026-09-30");
    await user.click(await screen.findByRole("button", { name: "Actualizar gasto" }));
    await screen.findByText("Datos actualizados.");
    expect(post).toHaveBeenCalledWith(
      `${ROOT}/meta/sync`,
      { from: "2026-09-01", to: "2026-09-30" },
      expect.any(Object),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps updates unavailable without the permission to manage accounts", async () => {
    canManage = false;
    renderPanel("2026-09-01", "2026-09-30");
    await screen.findByText("Necesitas permiso para gestionar estas cuentas.");
    expect(screen.queryByRole("button", { name: "Actualizar gasto" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elegir cuentas" })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });
});

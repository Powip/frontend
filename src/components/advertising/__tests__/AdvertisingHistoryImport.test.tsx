import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosError } from "axios";
import axios from "axios";
import { StrictMode } from "react";
import type {
  AdvertisingAccountWire,
  AdvertisingHistoryImportState,
  AdvertisingSnapshotWire,
} from "@/services/advertisingService";
import { AdvertisingLivePanel } from "../AdvertisingLivePanel";

jest.mock("axios");
jest.mock("next/dynamic", () => ({ __esModule: true, default: () => () => null }));

const get = jest.mocked(axios.get);
const put = jest.mocked(axios.put);
const post = jest.mocked(axios.post);
const BASE = "https://integrations.example.test";
const COMPANY_ID = "b2222222-2222-4222-8222-222222222222";
const ACTOR_ID = "a1111111-1111-4111-8111-111111111111";
const TOKEN = "test-access-token";
const ROOT = `${BASE}/advertising/companies/${COMPANY_ID}`;
const previousBase = process.env.NEXT_PUBLIC_API_INTEGRATIONS;
let accounts: AdvertisingAccountWire[];
let canManage: boolean;
let denyStatus: number | null;
let queryClients: QueryClient[];

function history(
  status: AdvertisingHistoryImportState["status"] = "queued",
  fields: Partial<AdvertisingHistoryImportState> = {},
): AdvertisingHistoryImportState {
  return {
    id: "history-job-id",
    status,
    availableFrom: null,
    availableTo: null,
    completedWindows: 0,
    totalWindows: null,
    errorCode: null,
    ...fields,
  };
}

function snapshot(): AdvertisingSnapshotWire {
  return {
    accounts: accounts.map((item) => ({
      ...item,
      historyImport: item.historyImport ? { ...item.historyImport } : null,
    })),
    days: [],
    manualRecords: [],
    providers: {
      meta: {
        available: true,
        status: accounts.some((item) => item.enabled) ? "connected" : "paused",
      },
      tiktok: { available: false, status: "disconnected" },
    },
    capabilities: { canManage, canReconcile: false },
    today: "2026-10-10",
  };
}

function renderPanel(from = "2026-10-01", to = "2026-10-10", connectionsOnly = true) {
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
          connectionsOnly={connectionsOnly}
        />
      </QueryClientProvider>
    </StrictMode>,
  );
}

function snapshotCalls() {
  return get.mock.calls.filter(([url]) => url === `${ROOT}/snapshot`).length;
}

beforeEach(() => {
  jest.resetAllMocks();
  window.history.replaceState(null, "", "/configuracion/integraciones/publicidad");
  process.env.NEXT_PUBLIC_API_INTEGRATIONS = BASE;
  accounts = [
    {
      id: "account-id",
      provider: "meta",
      externalId: "123",
      name: "Cuenta Lima",
      currency: "PEN",
      timeZone: "America/Lima",
      enabled: true,
      connectionId: "connection-id",
      syncFrom: "2026-10-01",
      lastAttemptAt: null,
      lastSuccessfulAt: null,
      updatedAt: null,
    },
  ];
  canManage = true;
  denyStatus = null;
  queryClients = [];
  jest
    .mocked(axios.isAxiosError)
    .mockImplementation(
      (value: unknown): value is AxiosError =>
        typeof value === "object" && value !== null && "isAxiosError" in value,
    );
  get.mockImplementation(async (url) => {
    if (url === `${ROOT}/snapshot`) {
      if (denyStatus) throw { isAxiosError: true, response: { status: denyStatus } };
      return { data: snapshot() };
    }
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
    const selection = payload as { externalIds: string[] };
    accounts = accounts.map((item) => ({
      ...item,
      enabled: selection.externalIds.includes(item.externalId),
      historyImport: selection.externalIds.includes(item.externalId)
        ? history()
        : item.historyImport
          ? { ...item.historyImport, status: "paused" }
          : null,
    }));
    return {
      data: {
        selectedCount: selection.externalIds.length,
        imports: accounts.flatMap((item) =>
          item.enabled && item.historyImport ? [{ ...item.historyImport, accountId: item.id }] : [],
        ),
      },
    };
  });
  post.mockImplementation(async (url, payload) => {
    if (url !== `${ROOT}/meta/history-import`) throw new Error(`Unexpected fixture POST: ${url}`);
    expect(payload).toEqual({});
    accounts = accounts.map((item) => ({
      ...item,
      historyImport:
        item.historyImport?.status === "running" || item.historyImport?.status === "queued"
          ? item.historyImport
          : history(),
    }));
    return {
      data: {
        imports: accounts.flatMap((item) =>
          item.enabled && item.historyImport ? [{ ...item.historyImport, accountId: item.id }] : [],
        ),
      },
    };
  });
});

afterEach(() => {
  cleanup();
  for (const client of queryClients) client.clear();
  jest.useRealTimers();
  jest.restoreAllMocks();
  window.dispatchEvent(new Event("visibilitychange"));
});

afterAll(() => {
  if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_INTEGRATIONS;
  else process.env.NEXT_PUBLIC_API_INTEGRATIONS = previousBase;
});

describe("automatic advertising history import", () => {
  it.each([
    { from: "2026-09-01", to: "2026-09-30" },
    { from: "2026-10-01", to: "2026-10-31" },
    { from: "2025-04-01", to: "2025-04-30" },
  ])(
    "saves only reviewed accounts, independently of the filter $from to $to",
    async ({ from, to }) => {
      const user = userEvent.setup();
      renderPanel(from, to);
      await user.click(await screen.findByRole("button", { name: "Elegir cuentas" }));
      expect(await screen.findByRole("checkbox", { name: /Cuenta Lima/ })).toBeChecked();
      expect(screen.queryByLabelText("Consultar desde")).not.toBeInTheDocument();
      expect(document.querySelector('input[type="date"]')).toBeNull();
      await user.click(screen.getByRole("button", { name: "Continuar con 1 cuenta" }));
      expect(screen.getByText("Importaremos todo el historial disponible.")).toBeVisible();
      expect(put).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Guardar cuentas" }));
      await waitFor(() =>
        expect(screen.getAllByText("Importando historial…").length).toBeGreaterThan(0),
      );
      expect(put).toHaveBeenCalledTimes(1);
      expect(put).toHaveBeenCalledWith(
        `${ROOT}/meta/accounts`,
        { externalIds: ["123"] },
        expect.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } }),
      );
      expect(post).not.toHaveBeenCalled();
      expect(get).toHaveBeenCalledWith(
        `${ROOT}/snapshot`,
        expect.objectContaining({ params: { from, to } }),
      );
    },
  );

  it("keeps imports stopped when the reviewed selection removes the account", async () => {
    const user = userEvent.setup();
    accounts[0].historyImport = history("running");
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "Elegir cuentas" }));
    await user.click(await screen.findByRole("checkbox", { name: /Cuenta Lima/ }));
    await user.click(screen.getByRole("button", { name: "Continuar con 0 cuentas" }));
    expect(screen.getByText("Las cuentas dejarán de actualizarse.")).toBeVisible();
    expect(put).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Guardar cuentas" }));
    await screen.findByText("Cuentas guardadas.");
    expect(put).toHaveBeenCalledWith(
      `${ROOT}/meta/accounts`,
      { externalIds: [] },
      expect.any(Object),
    );
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByText("Importación pausada")).toBeVisible();
  });

  it("replaces the queued save notice with the worker result instead of keeping stale progress", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    accounts[0].historyImport = history("succeeded", { id: "old-history-job" });
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "Elegir cuentas" }));
    await screen.findByRole("checkbox", { name: /Cuenta Lima/ });
    await user.click(screen.getByRole("button", { name: "Continuar con 1 cuenta" }));
    await user.click(screen.getByRole("button", { name: "Guardar cuentas" }));
    await waitFor(() =>
      expect(screen.getAllByText("Importando historial…").length).toBeGreaterThan(0),
    );
    expect(screen.queryByText("Historial disponible importado.")).not.toBeInTheDocument();
    accounts[0].historyImport = history("succeeded");
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.getByText("Historial disponible importado.")).toBeVisible();
    expect(screen.queryByText("Importando historial…")).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("requests or reuses an import without turning an old display period into a cutoff", async () => {
    const user = userEvent.setup();
    accounts[0].historyImport = history("running");
    renderPanel("2026-09-01", "2026-09-30");
    await user.click(await screen.findByRole("button", { name: "Actualizar gasto" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(
      `${ROOT}/meta/history-import`,
      {},
      expect.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } }),
    );
    expect(accounts[0].historyImport?.id).toBe("history-job-id");
    expect(put).not.toHaveBeenCalled();
    expect(screen.queryByText("No hay cuentas activas para actualizar.")).not.toBeInTheDocument();
  });

  it("resumes visible polling after reentry and stops once the stored job succeeds", async () => {
    jest.useFakeTimers();
    accounts[0].historyImport = history();
    const first = renderPanel();
    await screen.findByText("Importando historial…");
    first.unmount();
    renderPanel("2026-09-01", "2026-09-30");
    await screen.findByText("Importando historial…");
    const before = snapshotCalls();
    accounts[0].historyImport = history("running", {
      availableFrom: "2025-04-15",
      availableTo: "2026-10-10",
      completedWindows: 2,
      totalWindows: 8,
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });
    expect(snapshotCalls()).toBe(before + 1);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
    accounts[0].historyImport = history("succeeded", {
      availableFrom: "2025-04-15",
      availableTo: "2026-10-10",
      completedWindows: 8,
      totalWindows: 8,
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.getByText("Historial disponible importado")).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    const completed = snapshotCalls();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15_000);
    });
    expect(snapshotCalls()).toBe(completed);
    expect(post).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it.each([401, 403])(
    "hides prior account data and stops polling after a %s denial",
    async (status) => {
      jest.useFakeTimers();
      accounts[0].historyImport = history();
      renderPanel();
      await screen.findByText("Importando historial…");
      denyStatus = status;
      await act(async () => {
        await jest.advanceTimersByTimeAsync(5_000);
      });
      expect(screen.getByRole("alert")).toHaveTextContent(
        status === 401
          ? "Vuelve a iniciar sesión para continuar."
          : "No tienes permiso para continuar.",
      );
      expect(screen.queryByText("Cuenta Lima")).not.toBeInTheDocument();
      const denied = snapshotCalls();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(15_000);
      });
      expect(snapshotCalls()).toBe(denied);
      expect(post).not.toHaveBeenCalled();
    },
  );

  it("stops polling a failed import and lets the manager retry the same account", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    accounts[0].historyImport = history("running");
    renderPanel();
    await screen.findByText("Importando historial…");
    accounts[0].historyImport = history("failed", { errorCode: "PROVIDER_UNAVAILABLE" });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.getByText("Importación incompleta")).toBeVisible();
    expect(screen.queryByText("PROVIDER_UNAVAILABLE")).not.toBeInTheDocument();
    const failed = snapshotCalls();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15_000);
    });
    expect(snapshotCalls()).toBe(failed);
    await user.click(screen.getByRole("button", { name: "Actualizar gasto" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(accounts[0].historyImport?.status).toBe("queued");
    expect(screen.getAllByText("Importando historial…").length).toBeGreaterThan(0);
  });

  it("does not poll while the page is hidden", async () => {
    jest.useFakeTimers();
    accounts[0].historyImport = history();
    renderPanel();
    await screen.findByText("Importando historial…");
    const before = snapshotCalls();
    jest.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      window.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15_000);
    });
    expect(snapshotCalls()).toBe(before);
  });

  it("separates unavailable history from zero or pending period coverage", async () => {
    accounts[0].historyImport = history("succeeded", {
      availableFrom: "2026-10-01",
      availableTo: "2026-10-10",
      completedWindows: 1,
      totalWindows: 1,
    });
    renderPanel("2026-09-01", "2026-09-30", false);
    expect(await screen.findByText("Historial no disponible")).toBeVisible();
    expect(screen.getByText("Historial disponible importado")).toBeVisible();
    expect(screen.getAllByText("Pendiente").length).toBeGreaterThan(0);
    expect(screen.queryByText(/cero confirmado/)).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("keeps import actions unavailable without the permission to manage accounts", async () => {
    canManage = false;
    renderPanel();
    await screen.findByText("Necesitas permiso para gestionar estas cuentas.");
    expect(screen.queryByRole("button", { name: "Actualizar gasto" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elegir cuentas" })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });
});

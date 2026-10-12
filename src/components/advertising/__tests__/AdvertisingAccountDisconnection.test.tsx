import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosError } from "axios";
import axios from "axios";
import type {
  AdvertisingAccountWire,
  AdvertisingDisconnectPreview,
  AdvertisingSnapshotWire,
} from "@/services/advertisingService";
import { advertisingDisconnectErrorMessage } from "@/services/advertisingService";
import { AdvertisingDisconnectAccountDialog } from "../AdvertisingDisconnectAccountDialog";
import { AdvertisingLivePanel } from "../AdvertisingLivePanel";

jest.mock("axios");
jest.mock("next/dynamic", () => ({ __esModule: true, default: () => () => null }));
const post = jest.mocked(axios.post);
const get = jest.mocked(axios.get);
const BASE = "https://integrations.example.test";
const COMPANY = "b2222222-2222-4222-8222-222222222222";
const ACTOR = "a1111111-1111-4111-8111-111111111111";
const TOKEN = "fixture-access-token";
const ACCOUNT = "c3333333-3333-4333-8333-333333333333";
const ROOT = `${BASE}/advertising/companies/${COMPANY}`;
const PREVIEW = `${ROOT}/accounts/${ACCOUNT}/disconnect-preview`;
const CONFIRM = `${ROOT}/accounts/${ACCOUNT}/disconnect`;
const previousBase = process.env.NEXT_PUBLIC_API_INTEGRATIONS;
let clients: QueryClient[] = [];
let wire: AdvertisingSnapshotWire;

const account: AdvertisingAccountWire = {
  id: ACCOUNT,
  provider: "meta",
  externalId: "123",
  name: "Cuenta Lima",
  currency: "PEN",
  timeZone: "America/Lima",
  enabled: false,
  connectionId: "connection-id",
  syncFrom: "2025-01-01",
  lastAttemptAt: null,
  lastSuccessfulAt: null,
  updatedAt: null,
};
function preview(fields: Partial<AdvertisingDisconnectPreview> = {}): AdvertisingDisconnectPreview {
  return {
    account: { id: ACCOUNT, provider: "meta", name: "Cuenta Lima" },
    alreadyDisconnected: false,
    deleteCounts: {
      ledgerDays: 31,
      metaObjects: 18,
      metaAdDays: 302,
      metaCoverageDays: 31,
      metaCatalogStates: 1,
    },
    preservedManualRecords: 2,
    previewVersion: "fixture-preview-version",
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    ...fields,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function renderDialog(
  overrides: Partial<Parameters<typeof AdvertisingDisconnectAccountDialog>[0]> = {},
) {
  const props = {
    actorId: ACTOR,
    companyId: COMPANY,
    token: TOKEN,
    account,
    canDisconnect: true,
    onClose: jest.fn(),
    onDisconnected: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const view = render(<AdvertisingDisconnectAccountDialog {...props} />);
  return { ...view, props };
}
function panel(client: QueryClient, connectionsOnly = true) {
  return (
    <QueryClientProvider client={client}>
      <AdvertisingLivePanel
        companyId={COMPANY}
        actorId={ACTOR}
        token={TOKEN}
        companyName="Empresa de prueba"
        from="2026-10-01"
        to="2026-10-10"
        connectionsOnly={connectionsOnly}
        presentation="module"
      />
    </QueryClientProvider>
  );
}
function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return { ...render(panel(client)), client };
}
beforeEach(() => {
  jest.resetAllMocks();
  process.env.NEXT_PUBLIC_API_INTEGRATIONS = BASE;
  window.history.replaceState(null, "", "/publicidad/conexiones");
  jest
    .mocked(axios.isAxiosError)
    .mockImplementation(
      (value: unknown): value is AxiosError =>
        typeof value === "object" && value !== null && "isAxiosError" in value,
    );
  wire = {
    accounts: [{ ...account }],
    days: [
      {
        accountId: ACCOUNT,
        date: "2026-10-01",
        amount: "10.000001",
        currency: "PEN",
        provisional: false,
        sourceRevision: null,
        updatedAt: "2026-10-01T00:00:00Z",
      },
    ],
    manualRecords: [
      {
        id: "manual-id",
        source: "pauta",
        browserKey: "fixture-browser",
        sourceId: "manual-original-reference",
        date: "2026-10-01",
        amount: "4.50",
        currency: "PEN",
        status: "pending",
        importedAccountId: ACCOUNT,
        resolutionVersion: 2,
      },
    ],
    providers: {
      meta: { available: true, status: "connected" },
      tiktok: { available: false, status: "disconnected" },
    },
    capabilities: { canManage: true, canReconcile: true, canDisconnect: true },
    today: "2026-10-10",
  };
  get.mockImplementation(async (url) => {
    if (url === `${ROOT}/snapshot`) return { data: wire };
    throw new Error(`Unexpected fixture GET ${url}`);
  });
  post.mockImplementation(async (url) => {
    if (url === PREVIEW) return { data: preview() };
    if (url === CONFIRM) {
      wire = {
        ...wire,
        accounts: [
          {
            ...account,
            enabled: false,
            connectionId: null,
            disconnectedAt: new Date().toISOString(),
            historyImport: null,
          },
        ],
        days: [],
      };
      return {
        data: {
          disconnected: true,
          alreadyDisconnected: false,
          deletedCounts: preview().deleteCounts,
        },
      };
    }
    throw new Error(`Unexpected fixture POST ${url}`);
  });
});
afterEach(() => {
  cleanup();
  clients.forEach((client) => {
    client.clear();
  });
  clients = [];
  jest.useRealTimers();
});
afterAll(() => {
  if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_INTEGRATIONS;
  else process.env.NEXT_PUBLIC_API_INTEGRATIONS = previousBase;
});

describe("owned advertising account disconnection", () => {
  it.each([401, 403, 404, 409, 400, 503, 500])(
    "uses a fixed safe message for %s failures",
    (status) => {
      const failure = {
        isAxiosError: true,
        response: {
          status,
          data: {
            errorCode: "private token",
            message: "another-company@example.test private-token",
          },
        },
      };
      const message = advertisingDisconnectErrorMessage(failure);
      expect(message).not.toContain("private");
      expect(message).not.toContain("another-company");
      expect(message).not.toContain("token");
      expect(message).not.toContain(TOKEN);
    },
  );

  it("cancels and aborts a pending preview without applying a late response", async () => {
    const user = userEvent.setup();
    const pending = deferred<{ data: AdvertisingDisconnectPreview }>();
    post.mockReturnValueOnce(pending.promise);
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "Desconectar cuenta" }));
    const signal = post.mock.calls[0][2]?.signal;
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(signal?.aborted).toBe(true);
    await act(async () => pending.resolve({ data: preview() }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(post.mock.calls.some(([url]) => url === CONFIRM)).toBe(false);
  });

  it("blocks an already prepared confirmation once its review expires", async () => {
    jest.useFakeTimers();
    post.mockResolvedValueOnce({
      data: preview({ expiresAt: new Date(Date.now() + 1_000).toISOString() }),
    });
    renderDialog();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "Desconectar y eliminar" })).toBeEnabled();
    act(() => {
      jest.advanceTimersByTime(1_001);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("La revisión caducó");
    expect(
      screen.queryByRole("button", { name: "Desconectar y eliminar" }),
    ).not.toBeInTheDocument();
    expect(post.mock.calls.some(([url]) => url === CONFIRM)).toBe(false);
  });

  it("does nothing on page load, previews a paused owned account, and cancels without deleting", async () => {
    const user = userEvent.setup();
    renderPanel();
    const button = await screen.findByRole("button", { name: "Desconectar cuenta" });
    expect(post).not.toHaveBeenCalled();
    await user.click(button);
    await screen.findByText("Días de gasto");
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      PREVIEW,
      {},
      expect.objectContaining({
        headers: { Authorization: `Bearer ${TOKEN}` },
        withCredentials: false,
        signal: expect.any(AbortSignal),
      }),
    );
    expect(screen.getByText("31")).toBeVisible();
    expect(screen.getByText("18")).toBeVisible();
    expect(screen.getByText("302")).toBeVisible();
    expect(
      screen.getByText(/Se conservarán pedidos, registros manuales y auditorías/),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(post.mock.calls.some(([url]) => url === CONFIRM)).toBe(false);
  });

  it.each(["manage", "reconcile", "disconnect", "legacy"])(
    "hides the action without the %s capability",
    async (missing) => {
      if (missing === "manage") wire.capabilities.canManage = false;
      if (missing === "reconcile") wire.capabilities.canReconcile = false;
      if (missing === "disconnect") wire.capabilities.canDisconnect = false;
      if (missing === "legacy") delete wire.capabilities.canDisconnect;
      renderPanel();
      await screen.findByText("Conectada");
      expect(screen.queryByRole("button", { name: "Desconectar cuenta" })).not.toBeInTheDocument();
      expect(post).not.toHaveBeenCalled();
    },
  );

  it("keeps archived accounts unavailable for operations while preserving their manual records", async () => {
    wire.accounts[0].disconnectedAt = new Date().toISOString();
    wire.days = [];
    const view = renderPanel();
    await screen.findByText("Conectada");
    expect(screen.queryByText("Cuenta Lima")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desconectar cuenta" })).not.toBeInTheDocument();
    view.rerender(panel(view.client, false));
    fireEvent.click(await screen.findByText("Consumo total y gastos manuales"));
    expect(await screen.findByText(/manual-original-reference/)).toBeVisible();
    expect(post).not.toHaveBeenCalled();
  });

  it("clears imported caches only for this actor and company, refreshes the account, and retains manual rows", async () => {
    const user = userEvent.setup();
    const view = renderPanel();
    for (const prefix of [
      "advertising-meta",
      "advertising-workspace",
      "advertising-orders",
      "advertising-order-comparison",
    ])
      view.client.setQueryData([prefix, ACTOR, COMPANY, "fixture"], { oldImported: true });
    view.client.setQueryData(["advertising-meta", "another-actor", COMPANY, "fixture"], {
      isolated: true,
    });
    view.client.setQueryData(["advertising-meta", ACTOR, "another-company", "fixture"], {
      isolated: true,
    });
    await user.click(await screen.findByRole("button", { name: "Desconectar cuenta" }));
    await screen.findByText("Días de gasto");
    await user.click(screen.getByRole("button", { name: "Desconectar y eliminar" }));
    await screen.findByText("Cuenta desconectada.");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Desconectar cuenta" })).not.toBeInTheDocument(),
    );
    expect(post.mock.calls.filter(([url]) => url === CONFIRM)).toHaveLength(1);
    expect(post).toHaveBeenCalledWith(
      CONFIRM,
      { previewVersion: "fixture-preview-version", confirmed: true },
      expect.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` }, timeout: 60_000 }),
    );
    for (const prefix of [
      "advertising-meta",
      "advertising-workspace",
      "advertising-orders",
      "advertising-order-comparison",
    ])
      expect(view.client.getQueryData([prefix, ACTOR, COMPANY, "fixture"])).toBeUndefined();
    expect(
      view.client.getQueryData(["advertising-meta", "another-actor", COMPANY, "fixture"]),
    ).toEqual({ isolated: true });
    expect(
      view.client.getQueryData(["advertising-meta", ACTOR, "another-company", "fixture"]),
    ).toEqual({ isolated: true });
    view.rerender(panel(view.client, false));
    fireEvent.click(await screen.findByText("Consumo total y gastos manuales"));
    expect(await screen.findByText(/manual-original-reference/)).toBeVisible();
    expect(screen.queryByText("Cuenta Lima")).not.toBeInTheDocument();
  });

  it("disables confirmation until preview is complete and submits the destructive request once", async () => {
    const user = userEvent.setup();
    const pendingPreview = deferred<{ data: AdvertisingDisconnectPreview }>();
    const pendingConfirm = deferred<{ data: { disconnected: true } }>();
    post.mockReturnValueOnce(pendingPreview.promise).mockReturnValueOnce(pendingConfirm.promise);
    const view = renderDialog();
    expect(screen.getByRole("button", { name: "Desconectar y eliminar" })).toBeDisabled();
    expect(view.props.onDisconnected).not.toHaveBeenCalled();
    await act(async () => pendingPreview.resolve({ data: preview() }));
    const confirm = screen.getByRole("button", { name: "Desconectar y eliminar" });
    await user.dblClick(confirm);
    expect(post.mock.calls.filter(([url]) => url === CONFIRM)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Desconectando…" })).toBeDisabled();
    await act(async () => pendingConfirm.resolve({ data: { disconnected: true } }));
    expect(view.props.onDisconnected).toHaveBeenCalledTimes(1);
  });

  it.each(["DISCONNECTION_PREVIEW_STALE", "ACCOUNT_BUSY"])(
    "requires a new preview after %s and never retries deletion automatically",
    async (errorCode) => {
      const user = userEvent.setup();
      const view = renderDialog();
      await screen.findByText("Días de gasto");
      post.mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 409, data: { errorCode, message: "private other company token" } },
      });
      await user.click(screen.getByRole("button", { name: "Desconectar y eliminar" }));
      expect(await screen.findByRole("alert")).not.toHaveTextContent("private other company token");
      expect(
        screen.queryByRole("button", { name: "Desconectar y eliminar" }),
      ).not.toBeInTheDocument();
      expect(view.props.onDisconnected).not.toHaveBeenCalled();
      expect(post.mock.calls.filter(([url]) => url === CONFIRM)).toHaveLength(1);
      await user.click(screen.getByRole("button", { name: "Volver a revisar" }));
      expect(await screen.findByRole("button", { name: "Desconectar y eliminar" })).toBeEnabled();
      expect(post.mock.calls.filter(([url]) => url === PREVIEW)).toHaveLength(2);
      expect(post.mock.calls.filter(([url]) => url === CONFIRM)).toHaveLength(1);
    },
  );

  it.each(["actor", "company", "account", "token"])(
    "ignores a late preview from the old %s scope",
    async (changed) => {
      const pending = deferred<{ data: AdvertisingDisconnectPreview }>();
      post.mockReturnValueOnce(pending.promise).mockReturnValue(new Promise(() => undefined));
      const view = renderDialog();
      const oldSignal = post.mock.calls[0][2]?.signal;
      const props = {
        ...view.props,
        actorId: changed === "actor" ? "new-actor" : ACTOR,
        companyId: changed === "company" ? "new-company" : COMPANY,
        token: changed === "token" ? "new-token" : TOKEN,
        account: changed === "account" ? { ...account, id: "new-account" } : account,
      };
      view.rerender(<AdvertisingDisconnectAccountDialog {...props} />);
      expect(oldSignal?.aborted).toBe(true);
      await act(async () => pending.resolve({ data: preview() }));
      expect(screen.queryByText("Días de gasto")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Desconectar y eliminar" })).toBeDisabled();
      expect(post.mock.calls.some(([url]) => url === CONFIRM)).toBe(false);
    },
  );

  it("ignores a late deletion result after switching company and does not invoke its old callback", async () => {
    const user = userEvent.setup();
    const view = renderDialog();
    await screen.findByText("Días de gasto");
    const pending = deferred<{ data: { disconnected: true } }>();
    post.mockReturnValueOnce(pending.promise);
    await user.click(screen.getByRole("button", { name: "Desconectar y eliminar" }));
    const signal = post.mock.calls.find(([url]) => url === CONFIRM)?.[2]?.signal;
    post.mockReturnValue(new Promise(() => undefined));
    view.rerender(<AdvertisingDisconnectAccountDialog {...view.props} companyId="new-company" />);
    expect(signal?.aborted).toBe(true);
    await act(async () => pending.resolve({ data: { disconnected: true } }));
    expect(view.props.onDisconnected).not.toHaveBeenCalled();
    expect(post.mock.calls.filter(([url]) => url === CONFIRM)).toHaveLength(1);
  });

  it.each(["foreign-account", "invalid-count", "expired"])(
    "keeps malformed or unusable %s previews from confirming",
    async (reason) => {
      const value = preview();
      if (reason === "foreign-account") value.account.id = "foreign-account";
      if (reason === "invalid-count") value.deleteCounts.metaCoverageDays = -1;
      if (reason === "expired") value.expiresAt = new Date(Date.now() - 1).toISOString();
      post.mockResolvedValueOnce({ data: value });
      renderDialog();
      await screen.findByRole("alert");
      expect(
        screen.queryByRole("button", { name: "Desconectar y eliminar" }),
      ).not.toBeInTheDocument();
      expect(post.mock.calls.some(([url]) => url === CONFIRM)).toBe(false);
    },
  );

  it("treats an already disconnected preview as read only", async () => {
    post.mockResolvedValueOnce({
      data: preview({ alreadyDisconnected: true, previewVersion: null, expiresAt: null }),
    });
    const view = renderDialog();
    expect(await screen.findByText("Esta cuenta ya está desconectada.")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Desconectar y eliminar" }),
    ).not.toBeInTheDocument();
    expect(view.props.onDisconnected).not.toHaveBeenCalled();
    expect(post.mock.calls.some(([url]) => url === CONFIRM)).toBe(false);
  });
});

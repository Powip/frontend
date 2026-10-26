import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import { AdvertisingAds } from "../Ads";
import { AdvertisingV22Provider, useAdsV22 } from "../context";
import { emptySales } from "../model";
import { exportAdsWorkbook } from "../shared";
import type { AdsRow, AdsSavedView, AdsSettings } from "@/services/advertisingV22Service";
import type { ActionSelection } from "../Actions";

const mockSetPeriod = jest.fn();
const mockSetStore = jest.fn();
const mockAuth = {
  auth: { user: { id: "actor" }, accessToken: "token", company: { id: "company" } },
};
const mockSettings = {
  version: 1,
  rules: {
    noResultsDays: 3,
    minSpend: "1",
    nearLimitPct: 70,
    highFrequency: 3.5,
    winPct: 60,
    testMultiplier: 2,
    testMinSales: 3,
  },
  tags: { hooks: [], creators: [] },
  capabilities: { view: true, spend: true, profit: true, edit: false },
  permissions: [],
  budgets: [],
  whatsapp: { enabled: false, time: "08:00", numbers: [], includes: [] },
} as AdsSettings;
let mockCount = 101;
let mockPartial = false;
let mockRateLimited = false;
let mockCanManage: boolean | undefined = false;
let mockMultipleAccounts = false;
let mockRowChanges: Partial<AdsRow> = {};
let mockStoreId = "all";
let mockCatalogPending = false;
let mockAdCatalogError = false;
let mockNumbersPending = false;
let mockNumbersError = false;
let mockScalePending = false;
let mockViews: AdsSavedView[] = [];
const mockNumberRequests: Array<{ storeId: string; key: string }> = [];
let mockFromDate = "2026-10-01";
const mockRows = () =>
  Array.from(
    { length: mockCount },
    (_, index) =>
      ({
        id: String(index + 1),
        accountId: mockMultipleAccounts && index >= 100 ? "other-account" : "account",
        campaignId: "campaign",
        adsetId: "set",
        level: "ad",
        objective: "OUTCOME_ENGAGEMENT",
        name: `Anuncio ${String(index + 1).padStart(3, "0")}`,
        status: "ACTIVE",
        effectiveStatus: "ACTIVE",
        daysActive: 5,
        currency: "PEN",
        timeZone: "America/Lima",
        store: { id: "store", name: "Tienda" },
        creative: { format: "image" },
        insights: {
          spend: "1",
          clicks: "2",
          coverage: {
            status: mockPartial ? "partial" : "complete",
            coveredDays: 16,
            totalDays: 16,
            provisionalDays: 0,
            lastSuccessfulAt: null,
            lastErrorCode: null,
          },
          impressions: "1000",
          inlineLinkClicks: "2",
          actions: [],
          ctr: "0.2",
          frequency: "1",
          resultMetrics: {
            messages: {
              count: mockPartial ? null : "1",
              costPerResult: mockPartial ? null : "1",
              status: mockPartial ? "unknown" : "complete",
            },
            webPurchases: { count: "0", costPerResult: null, status: "complete" },
          },
        },
        ...mockRowChanges,
      }) as AdsRow,
  );
const mockNumbers = () => ({
  data: {
    summary: {
      source: "powip-advertising-v22",
      from: "2026-10-01",
      to: "2026-10-16",
      today: "2026-10-17",
      currency: "PEN",
      timeZone: "America/Lima",
      settings: mockSettings,
      stores: [{ id: "store", name: "Tienda" }],
      channels: [],
      adProducts: [],
      days: mockRows().map((row) => ({
        adId: row.id,
        accountId: "account",
        adsetId: "set",
        campaignId: "campaign",
        storeId: "store",
        date: "2026-10-01",
        channel: "messages",
        currency: "PEN",
        spend: "1",
        results: mockPartial ? null : 1,
        impressions: "1000",
        linkClicks: "2",
        provisional: false,
      })),
      unassignedSpend: "0",
      quality: {
        warnings: mockPartial ? ["META_DATA_PARTIAL"] : [],
        coverage: mockPartial ? "partial" : "complete",
        spendAvailable: !mockPartial,
      },
    },
    sales: {
      source: "powip-orders-v22",
      from: "2026-10-01",
      to: "2026-10-16",
      currency: "PEN",
      totals: emptySales(),
      byAd: [],
      byProduct: [],
      byStore: [],
      byChannel: [],
      daily: [],
      deliveryHistory: [],
      productVelocity: [],
      quality: {},
    },
  },
  isError: false,
  refetch: jest.fn(),
});
let mockSource: {
  data: ReturnType<typeof mockNumbers>["data"] | undefined;
  isError: boolean;
  error?: unknown;
  refetch: jest.Mock;
};
jest.mock("axios");
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("@/contexts/AdminPeriodContext", () => ({
  useAdminPeriod: () => ({
    fromDate: mockFromDate,
    toDate: "2026-10-16",
    setPeriod: mockSetPeriod,
  }),
}));
jest.mock("../../AdvertisingStoreFilterContext", () => ({
  useAdvertisingStoreFilter: () => ({
    storeId: mockStoreId,
    stores: [{ id: "store", name: "Tienda" }],
    setStoreId: mockSetStore,
  }),
}));
jest.mock("../Numbers", () => ({
  useNumbers: (_from: string, _to: string, storeId: string, key: string) => {
    mockNumberRequests.push({ storeId, key });
    return mockNumbersPending || mockNumbersError || (key === "scale-check" && mockScalePending)
      ? {
          ...mockSource,
          data: undefined,
          isError: mockNumbersError,
          error: mockNumbersError ? new Error("No se pudo leer ventas") : undefined,
        }
      : mockSource;
  },
}));
jest.mock("../Thumbnail", () => ({ AdThumbnail: () => <span /> }));
jest.mock("../Actions", () => ({
  AdvertisingActionDialog: () => null,
  META_MANAGEMENT_UNAVAILABLE: "No hay acceso confirmado para gestionar anuncios desde POWIP.",
}));
jest.mock("../AdDetail", () => ({
  AdvertisingAdDetail: ({ onClose, onAction, row }: { onClose: () => void; onAction: (value: ActionSelection) => void; row: AdsRow }) => (
    <><button onClick={onClose}>Cerrar detalle</button><button onClick={() => onAction({ rows: [row], action: "pause" })}>Pausar desde detalle</button></>
  ),
}));
jest.mock("../shared", () => ({
  ...jest.requireActual("../shared"),
  exportAdsWorkbook: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("recharts", () => ({
  Bar: () => null,
  BarChart: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  ResponsiveContainer: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
function ReadyAds() {
  const { settings } = useAdsV22();
  return settings?.capabilities.view ? <AdvertisingAds /> : null;
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={client}>
      <AdvertisingV22Provider>
        <ReadyAds />
      </AdvertisingV22Provider>
    </QueryClientProvider>,
  );
  return { ...result, client };
}
const catalogCalls = () =>
  (axios.get as jest.Mock).mock.calls.filter(([url]) => url.endsWith("/meta/v22/catalog"));
const visibleRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
beforeEach(() => {
  jest.clearAllMocks();
  mockCount = 101;
  mockPartial = false;
  mockRateLimited = false;
  mockCanManage = false;
  mockMultipleAccounts = false;
  mockSettings.capabilities.edit = false;
  mockRowChanges = {};
  mockStoreId = "all";
  mockCatalogPending = false;
  mockAdCatalogError = false;
  mockNumbersPending = false;
  mockNumbersError = false;
  mockScalePending = false;
  mockViews = [];
  mockNumberRequests.length = 0;
  mockFromDate = "2026-10-01";
  window.history.replaceState({}, "", "/publicidad/anuncios");
  mockSource = mockNumbers();
  process.env.NEXT_PUBLIC_API_INTEGRATIONS = "https://integrations.test";
  (axios.get as jest.Mock).mockImplementation(
    async (url: string, options: { params?: { page?: number; from?: string; level?: string } }) => {
      if (url.endsWith("/v22/settings")) return { data: mockSettings };
      if (url.endsWith("/v22/products")) return { data: { products: [] } };
      if (url.endsWith("/v22/views")) return { data: { views: mockViews } };
      if (url.endsWith("/meta/v22/hourly")) return { data: { rows: [], timeZone: "America/Lima" } };
      if (url.endsWith("/meta/v22/catalog")) {
        if (mockCatalogPending) return new Promise(() => {});
        if (mockAdCatalogError && options.params?.level === "ad")
          throw new Error("No se pudo leer el catálogo completo");
        const page = options.params?.page ?? 1;
        return {
          data: {
            rows: mockRows().slice((page - 1) * 100, page * 100),
            accounts: [
              {
                id: "account",
                name: "Cuenta",
                coverage: { lastErrorCode: mockRateLimited ? "PROVIDER_RATE" : null },
              },
            ],
            capabilities: { canManageAds: mockCanManage },
            pagination: { page, pageSize: 100, total: mockCount, hasMore: page * 100 < mockCount },
          },
        };
      }
      throw new Error(`Unexpected test route ${url}`);
    },
  );
});
it("queries catalog, financial inputs and creative references for the selected business", async () => {
  mockCount = 1;
  mockStoreId = "store";
  const view = mount();
  await screen.findByText("Mostrando 1–1 de 1");
  for (const key of ["ads", "scale-check", "today"])
    expect(mockNumberRequests.filter((request) => request.key === key).every((request) => request.storeId === "store")).toBe(true);
  expect(mockNumberRequests.some((request) => request.key === "ads")).toBe(true);
  fireEvent.change(screen.getByRole("combobox", { name: "Vista" }), { target: { value: "creatives" } });
  await waitFor(() => expect(catalogCalls().length).toBeGreaterThan(1));
  expect(catalogCalls().every(([, options]) => options.params.storeId === "store")).toBe(true);
  view.unmount();
  view.client.clear();
});
it("applies a saved view's filters and keeps them when its business changes", async () => {
  mockCount = 1;
  mockViews = [{ id: "saved", name: "Campañas web", icon: "", state: {
    level: "campaign", view: "performance", channel: "web", status: "Pausado",
    from: "2026-10-01", to: "2026-10-16", storeId: "store",
  } }];
  const view = mount();
  fireEvent.click(await screen.findByRole("button", { name: "Campañas web" }));
  expect(mockSetStore).toHaveBeenLastCalledWith("store");
  expect(mockSetPeriod).toHaveBeenLastCalledWith("2026-10-01", "2026-10-16");
  mockStoreId = "store";
  view.rerender(<QueryClientProvider client={view.client}><AdvertisingV22Provider><ReadyAds /></AdvertisingV22Provider></QueryClientProvider>);
  expect(screen.getByRole("combobox", { name: "Ver por" })).toHaveValue("campaign");
  expect(screen.getByRole("combobox", { name: "Canal" })).toHaveValue("web");
  expect(screen.getByRole("combobox", { name: "Vista" })).toHaveValue("performance");
  await waitFor(() => expect(catalogCalls().some(([, options]) => options.params.storeId === "store" && options.params.level === "campaign")).toBe(true));
  view.unmount();
  view.client.clear();
});

it("clears the old business's detail, pending action, undo and saved-view dialog on selection changes", async () => {
  mockCount = 1;
  const view = mount();
  fireEvent.click(await screen.findByRole("button", { name: /^Anuncio 001/ }));
  expect(screen.getByRole("button", { name: "Cerrar detalle" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Pausar desde detalle" }));
  const actionProps = mockAction.mock.calls[mockAction.mock.calls.length - 1][0] as {
    selection: ActionSelection | null;
    onPaused: (rows: AdsRow[]) => void;
  };
  expect(actionProps.selection?.rows[0].id).toBe("1");
  act(() => actionProps.onPaused(mockRows()));
  expect(screen.getByRole("button", { name: "Deshacer" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "+ Guardar vista actual" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  mockStoreId = "store";
  view.rerender(<QueryClientProvider client={view.client}><AdvertisingV22Provider><ReadyAds /></AdvertisingV22Provider></QueryClientProvider>);
  expect(screen.queryByRole("button", { name: "Cerrar detalle" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Deshacer" })).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(mockAction.mock.calls[mockAction.mock.calls.length - 1][0].selection).toBeNull();
  expect(axios.post).not.toHaveBeenCalled();
  view.unmount();
  view.client.clear();
});

it("keeps catalog counters unknown while the full catalog is pending", async () => {
  mockCatalogPending = true;
  const view = mount();
  await waitFor(() => expect(catalogCalls().length).toBeGreaterThan(0));
  expect(screen.getByRole("button", { name: "Todos —" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Pausado —" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Rentable —" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Todos 0" })).not.toBeInTheDocument();
  view.unmount();
  view.client.clear();
});

it("exposes a failed full-ad catalog and retries it while an account catalog succeeds", async () => {
  mockCount = 1;
  mockAdCatalogError = true;
  const view = mount();
  await screen.findByText("No se pudo leer el catálogo completo");
  fireEvent.change(screen.getByRole("combobox", { name: "Ver por" }), {
    target: { value: "account" },
  });
  await waitFor(() =>
    expect(catalogCalls().some(([, options]) => options.params.level === "account")).toBe(true),
  );
  await screen.findByText("Total · 1 grupos");
  expect(within(screen.getByRole("table")).getByText("Anuncio 001")).toBeInTheDocument();
  expect(screen.getByText("No se pudo leer el catálogo completo")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Todos —" })).toBeInTheDocument();
  const before = catalogCalls().filter(([, options]) => options.params.level === "ad").length;
  const accountRequests = catalogCalls().filter(([, options]) => options.params.level === "account").length;
  mockAdCatalogError = false;
  fireEvent.click(screen.getByRole("button", { name: "Volver a intentar" }));
  await screen.findByRole("button", { name: "Todos 1" });
  expect(catalogCalls().filter(([, options]) => options.params.level === "ad").length).toBeGreaterThan(before);
  expect(catalogCalls().filter(([, options]) => options.params.level === "account")).toHaveLength(accountRequests);
  expect(within(screen.getByRole("table")).getByText("Anuncio 001")).toBeInTheDocument();
  expect(screen.queryByText("No se pudo leer el catálogo completo")).not.toBeInTheDocument();
  view.unmount();
  view.client.clear();
});

it("confirms zero counters after an empty catalog succeeds even while sales are pending", async () => {
  mockCount = 0;
  mockNumbersPending = true;
  const view = mount();
  await screen.findByRole("button", { name: "Todos 0" });
  expect(screen.getByRole("button", { name: "Rentable 0" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Para escalar 0" })).toBeInTheDocument();
  view.unmount();
  view.client.clear();
});

it.each(["pending", "error"])("keeps financial counters unknown when sales are %s", async (state) => {
  mockCount = 1;
  mockRowChanges = { effectiveStatus: "PAUSED" };
  mockNumbersPending = state === "pending";
  mockNumbersError = state === "error";
  const view = mount();
  await screen.findByRole("button", { name: "Todos 1" });
  expect(screen.getByRole("button", { name: "Pausado 1" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Rentable —" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Para escalar —" })).toBeInTheDocument();
  view.unmount();
  view.client.clear();
});

it("waits for the scaling reference while keeping successful catalog and financial counts", async () => {
  mockCount = 1;
  mockScalePending = true;
  const view = mount();
  await screen.findByRole("button", { name: "Todos 1" });
  expect(screen.getByRole("button", { name: "Rentable 0" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Para escalar —" })).toBeInTheDocument();
  view.unmount();
  view.client.clear();
});
it("clears the old store drilldown before querying a newly selected store", async () => {
  mockCount = 1;
  mockRowChanges = { id: "store", level: "store", name: "Tienda" };
  mockSource = mockNumbers();
  const view = mount();
  await screen.findByText("Mostrando 1–1 de 1", {}, { timeout: 5000 });
  fireEvent.click(screen.getByRole("button", { name: /^Tienda Tienda/ }));
  await waitFor(() =>
    expect(catalogCalls().some(([, options]) => options.params.storeId === "store")).toBe(true),
  );
  expect(screen.getByRole("button", { name: "› Tienda: Tienda" })).toBeInTheDocument();
  const rerenderStore = (storeId: string) => {
    mockStoreId = storeId;
    view.rerender(
      <QueryClientProvider client={view.client}>
        <AdvertisingV22Provider>
          <ReadyAds />
        </AdvertisingV22Provider>
      </QueryClientProvider>,
    );
  };
  const before = catalogCalls().length;
  rerenderStore("other-store");
  await waitFor(() =>
    expect(
      catalogCalls().some(
        ([, options]) =>
          options.params.storeId === "other-store" && options.params.level === "account",
      ),
    ).toBe(true),
  );
  expect(
    catalogCalls()
      .slice(before)
      .every(([, options]) => options.params.storeId !== "store"),
  ).toBe(true);
  expect(screen.queryByRole("button", { name: "› Tienda: Tienda" })).not.toBeInTheDocument();
  rerenderStore("all");
  expect(screen.queryByRole("button", { name: "› Tienda: Tienda" })).not.toBeInTheDocument();
  view.unmount();
  view.client.clear();
});
it.each([false, undefined])(
  "does not offer Meta actions when management is %s despite POWIP editing access",
  async (canManage) => {
    mockCount = 1;
    mockSettings.capabilities.edit = true;
    mockCanManage = canManage;
    const view = mount();
    await screen.findByText("Mostrando 1–1 de 1");
    expect(
      screen.getByText("No hay acceso confirmado para gestionar anuncios desde POWIP."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pausar/ })).not.toBeInTheDocument();
    view.unmount();
    view.client.clear();
  },
);
it("offers Meta actions when the provider and POWIP both confirm access", async () => {
  mockCount = 1;
  mockSettings.capabilities.edit = true;
  mockCanManage = true;
  const view = mount();
  await screen.findByText("Mostrando 1–1 de 1");
  expect(screen.getByRole("button", { name: /Pausar/ })).toBeInTheDocument();
  view.unmount();
  view.client.clear();
});
it("does not use a positive aggregate capability to manage a different account from another page", async () => {
  mockCount = 101;
  mockSettings.capabilities.edit = true;
  mockCanManage = true;
  mockMultipleAccounts = true;
  const view = mount();
  await screen.findByText("Mostrando 1–50 de 101");
  expect(screen.getByText(/Esta vista incluye varias cuentas/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Pausar/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Gestionar en detalle" })[0]);
  expect(screen.getByRole("button", { name: "Cerrar detalle" })).toBeInTheDocument();
  view.unmount();
  view.client.clear();
});
it("explains a future-only period instead of keeping an inactive query in a loading state", async () => {
  mockFromDate = "2099-10-01";
  const view = mount();
  await screen.findByText("El período elegido todavía no tiene días transcurridos.");
  expect(catalogCalls()).toHaveLength(0);
  expect(screen.queryByLabelText("Cargando anuncios")).not.toBeInTheDocument();
  view.unmount();
  view.client.clear();
});
it.each([
  [false, false],
  [true, false],
  [true, true],
])(
  "shows Meta ads while commercial measurements fail or load (%s), including stale data (%s)",
  async (failed, stale) => {
    mockCount = 1;
    mockSource = {
      data: stale ? mockNumbers().data : undefined,
      isError: failed,
      error: failed ? new Error("No se pudieron consultar las ventas") : undefined,
      refetch: jest.fn(),
    };
    const view = mount();
    await screen.findByText("Mostrando 1–1 de 1");
    expect(within(visibleRows()[0]).getByText("Anuncio 001")).toBeInTheDocument();
    expect(within(visibleRows()[0]).getByText("S/ 1.00")).toBeInTheDocument();
    expect(within(visibleRows()[0]).getByText("Sin datos suficientes")).toBeInTheDocument();
    expect(screen.queryByLabelText("Cargando anuncios")).not.toBeInTheDocument();
    if (failed)
      expect(screen.getAllByRole("alert")[0]).toHaveTextContent(
        "No se pudieron consultar las ventas",
      );
    else
      expect(
        screen.getByText("Anuncios cargados. Consultando ventas y rentabilidad…"),
      ).toBeInTheDocument();
    view.unmount();
    view.client.clear();
  },
);
it("deduplicates identical full catalogs, loads every server page, limits DOM to 50 and exports the full filtered population", async () => {
  mockCount = 1115;
  mockSource = mockNumbers();
  const view = mount();
  await screen.findByText("Mostrando 1–50 de 1115", {}, { timeout: 5000 });
  expect(catalogCalls()).toHaveLength(12);
  expect(catalogCalls().map(([, options]) => options.params.page)).toEqual(
    Array.from({ length: 12 }, (_, index) => index + 1),
  );
  expect(visibleRows()).toHaveLength(50);
  fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
  expect(screen.getByText("Mostrando 51–100 de 1115")).toBeInTheDocument();
  expect(visibleRows()).toHaveLength(50);
  fireEvent.click(screen.getByRole("button", { name: "↓ Excel" }));
  expect(exportAdsWorkbook).toHaveBeenCalledWith(expect.any(String), [
    { name: "Anuncios", rows: expect.any(Array) },
  ]);
  expect((exportAdsWorkbook as jest.Mock).mock.calls[0][1][0].rows).toHaveLength(1115);
  fireEvent.change(screen.getByRole("textbox", { name: "Buscar anuncios" }), {
    target: { value: "Anuncio 001" },
  });
  expect(screen.getByText("Mostrando 1–1 de 1")).toBeInTheDocument();
  expect(visibleRows()).toHaveLength(1);
  expect(catalogCalls()).toHaveLength(12);
  view.unmount();
  view.client.clear();
});
it("requests the independent 30-day creative reference only after opening a creative view or detail", async () => {
  const view = mount();
  await screen.findByText("Mostrando 1–50 de 101");
  expect(catalogCalls()).toHaveLength(2);
  fireEvent.change(screen.getByRole("combobox", { name: "Vista" }), {
    target: { value: "creatives" },
  });
  await waitFor(() => expect(catalogCalls()).toHaveLength(4));
  expect(catalogCalls()[2][1].params.from).not.toBe("2026-10-01");
  fireEvent.change(screen.getByRole("combobox", { name: "Vista" }), {
    target: { value: "performance" },
  });
  expect(visibleRows()).toHaveLength(50);
  view.unmount();
  view.client.clear();
});
it("loads the creative reference when opening a detail from performance, then retains the current page", async () => {
  const view = mount();
  await screen.findByText("Mostrando 1–50 de 101");
  expect(catalogCalls()).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: /Anuncio 001/ }));
  await waitFor(() => expect(catalogCalls()).toHaveLength(4));
  expect(screen.getByRole("button", { name: "Cerrar detalle" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));
  expect(screen.getByText("Mostrando 1–50 de 101")).toBeInTheDocument();
  view.unmount();
  view.client.clear();
});
it("keeps observed ads visible under a channel filter while coverage and results are unknown, including null Excel amounts", async () => {
  mockCount = 1;
  mockPartial = true;
  mockSource = mockNumbers();
  const view = mount();
  await screen.findByText("Mostrando 1–1 de 1");
  fireEvent.change(screen.getByRole("combobox", { name: "Canal" }), {
    target: { value: "messages" },
  });
  expect(screen.getByText("Mostrando 1–1 de 1")).toBeInTheDocument();
  expect(within(visibleRows()[0]).getByText("Sin datos suficientes")).toBeInTheDocument();
  expect(within(visibleRows()[0]).queryByText("Sin resultados")).not.toBeInTheDocument();
  expect(within(visibleRows()[0]).queryByText("Revisa y pausa.")).not.toBeInTheDocument();
  expect(screen.getByText(/faltan referencias de anuncio/)).toBeInTheDocument();
  expect(screen.getByText(/La importación de Meta está incompleta/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "↓ Excel" }));
  const exported = (exportAdsWorkbook as jest.Mock).mock.calls[0][1][0].rows;
  expect(exported).toHaveLength(1);
  expect(exported[0]).toEqual(
    expect.objectContaining({
      Gasto: null,
      Ganancia: null,
      ROAS: null,
      Estado: "Sin datos suficientes",
    }),
  );
  view.unmount();
  view.client.clear();
});

it.each([
  ["CAMPAIGN_PAUSED", "La campaña está pausada."],
  ["ADSET_PAUSED", "El conjunto está pausado."],
])(
  "keeps inherited pauses out of Activos and exposes positive or zero spend in Todos: %s",
  async (effectiveStatus, reason) => {
    mockCount = 1;
    mockRowChanges = { effectiveStatus, status: "ACTIVE", pausedInPeriod: true };
    mockSource = mockNumbers();
    const view = mount();
    await screen.findByText(/Sin anuncios activos para estos filtros/);
    fireEvent.click(screen.getByRole("button", { name: "Pausado 1" }));
    expect(screen.getByRole("combobox", { name: "Mostrar" })).toHaveValue("all");
    await screen.findByText("Mostrando 1–1 de 1");
    expect(within(visibleRows()[0]).getByText("Pausado")).toBeInTheDocument();
    expect(within(visibleRows()[0]).getByText(reason)).toBeInTheDocument();
    expect(within(visibleRows()[0]).queryByText("Revisa y pausa.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pausado 1" }));
    fireEvent.click(screen.getByRole("button", { name: "↓ Excel" }));
    expect((exportAdsWorkbook as jest.Mock).mock.calls[0][1][0].rows[0].Estado).toBe("Pausado");
    view.unmount();
    view.client.clear();

    mockRowChanges = {
      ...mockRowChanges,
      insights: { ...mockRows()[0].insights, spend: "0" },
    };
    mockSource = mockNumbers();
    const zero = mount();
    await screen.findByText(/Sin anuncios activos para estos filtros/);
    fireEvent.change(screen.getByRole("combobox", { name: "Mostrar" }), {
      target: { value: "all" },
    });
    await screen.findByText("Mostrando 1–1 de 1");
    expect(within(visibleRows()[0]).getByText("Pausado")).toBeInTheDocument();
    zero.unmount();
    zero.client.clear();

    mockRowChanges = { ...mockRowChanges, pausedInPeriod: false };
    const unaudited = mount();
    await screen.findByText(/Sin anuncios activos para estos filtros/);
    fireEvent.change(screen.getByRole("combobox", { name: "Mostrar" }), {
      target: { value: "spend" },
    });
    expect(screen.getByText("Sin anuncios con gasto en este período.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Mostrar" }), {
      target: { value: "all" },
    });
    expect(screen.getByText("Mostrando 1–1 de 1")).toBeInTheDocument();
    unaudited.unmount();
    unaudited.client.clear();
  },
);
it.each(["messages", "web"])(
  "keeps catalog %s results, filters and detail usable when the Sales API fails",
  async (channel) => {
    mockCount = 1;
    const original = mockRows()[0].insights;
    mockRowChanges = {
      destinationType: channel === "web" ? "WEBSITE" : "WHATSAPP",
      insights: {
        ...original,
        resultMetrics: {
          messages: {
            count: channel === "messages" ? "3" : "0",
            costPerResult: "0.33",
            status: "complete",
          },
          webPurchases: {
            count: channel === "web" ? "3" : "0",
            costPerResult: "0.33",
            status: "complete",
          },
        },
      },
    };
    mockSource = {
      data: undefined,
      isError: true,
      error: new Error("Ventas no responde"),
      refetch: jest.fn(),
    };
    const view = mount();
    await screen.findByText("Mostrando 1–1 de 1");
    fireEvent.change(screen.getByRole("combobox", { name: "Canal" }), {
      target: { value: channel },
    });
    expect(screen.getByText("Mostrando 1–1 de 1")).toBeInTheDocument();
    expect(
      within(visibleRows()[0]).getByText(`${channel === "web" ? "Web" : "Mensajes"}: 3`),
    ).toBeInTheDocument();
    expect(within(visibleRows()[0]).getByText("Sin datos suficientes")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Ventas no responde");
    fireEvent.click(screen.getByRole("button", { name: /Anuncio 001/ }));
    expect(screen.getByRole("button", { name: "Cerrar detalle" })).toBeInTheDocument();
    view.unmount();
    view.client.clear();
  },
);

it("explains the recorded Meta rate limit while keeping the saved catalog visible", async () => {
  mockCount = 1;
  mockRateLimited = true;
  mockSource = mockNumbers();
  mount();
  await screen.findByText("Mostrando 1–1 de 1", {}, { timeout: 5000 });
  expect(screen.getByText(/Meta limitó temporalmente las consultas/)).toHaveTextContent(
    "Se muestra el catálogo guardado a la fecha indicada; actualización pendiente.",
  );
  expect(screen.getByText("Anuncio 001")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Actualizar Meta" })).toBeDisabled();
});

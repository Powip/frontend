import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import { AdvertisingAds } from "../Ads";
import { AdvertisingV22Provider, useAdsV22 } from "../context";
import { emptySales } from "../model";
import { exportAdsWorkbook } from "../shared";
import type { AdsRow, AdsSettings } from "@/services/advertisingV22Service";

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
const mockRows = () =>
  Array.from(
    { length: mockCount },
    (_, index) =>
      ({
        id: String(index + 1),
        accountId: "account",
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
let mockSource: ReturnType<typeof mockNumbers>;
jest.mock("axios");
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("@/contexts/AdminPeriodContext", () => ({
  useAdminPeriod: () => ({
    fromDate: "2026-10-01",
    toDate: "2026-10-16",
    setPeriod: mockSetPeriod,
  }),
}));
jest.mock("../../AdvertisingStoreFilterContext", () => ({
  useAdvertisingStoreFilter: () => ({
    storeId: "all",
    stores: [{ id: "store", name: "Tienda" }],
    setStoreId: mockSetStore,
  }),
}));
jest.mock("../Numbers", () => ({ useNumbers: () => mockSource }));
jest.mock("../Thumbnail", () => ({ AdThumbnail: () => <span /> }));
jest.mock("../Actions", () => ({ AdvertisingActionDialog: () => null }));
jest.mock("../AdDetail", () => ({
  AdvertisingAdDetail: ({ onClose }: { onClose: () => void }) => (
    <button onClick={onClose}>Cerrar detalle</button>
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
  window.history.replaceState({}, "", "/publicidad/anuncios");
  mockSource = mockNumbers();
  process.env.NEXT_PUBLIC_API_INTEGRATIONS = "https://integrations.test";
  (axios.get as jest.Mock).mockImplementation(
    async (url: string, options: { params?: { page?: number; from?: string } }) => {
      if (url.endsWith("/v22/settings")) return { data: mockSettings };
      if (url.endsWith("/v22/products")) return { data: { products: [] } };
      if (url.endsWith("/v22/views")) return { data: { views: [] } };
      if (url.endsWith("/meta/v22/hourly")) return { data: { rows: [], timeZone: "America/Lima" } };
      if (url.endsWith("/meta/v22/catalog")) {
        const page = options.params?.page ?? 1;
        return {
          data: {
            rows: mockRows().slice((page - 1) * 100, page * 100),
            accounts: [{ id: "account", name: "Cuenta" }],
            capabilities: {},
            pagination: { page, pageSize: 100, total: mockCount, hasMore: page * 100 < mockCount },
          },
        };
      }
      throw new Error(`Unexpected test route ${url}`);
    },
  );
});
it("deduplicates identical full catalogs, loads every server page, limits DOM to 50 and exports the full filtered population", async () => {
  mockCount = 1115;
  mockSource = mockNumbers();
  const view = mount();
  await screen.findByText("Mostrando 1–50 de 1115");
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

import { fireEvent, render, screen } from "@testing-library/react";
import { AdvertisingAdDetail } from "../AdDetail";
import { emptySales } from "../model";
import type { AdsProduct, AdsRow, AdsSales, AdsSummary } from "@/services/advertisingV22Service";

let mockProducts: AdsProduct[] = [];
let mockEdit = false;
let mockCanManage: boolean | undefined = true;
let mockVariations: Array<AdsRow & { variationType?: string; parentAdId?: string }> = [];
const mockRow = {
  id: "ad",
  accountId: "account",
  campaignId: "campaign",
  adsetId: "set",
  level: "ad",
  name: "Anuncio real",
  currency: "PEN",
  status: "ACTIVE",
  effectiveStatus: "ACTIVE",
  creative: { format: "image" },
  insights: { spend: "60", frequency: "1", impressions: "1000", actions: [] },
  store: { id: "store", name: "Tienda" },
} as unknown as AdsRow;
jest.mock("recharts", () => ({
  Bar: () => null,
  BarChart: () => null,
  CartesianGrid: () => null,
  Line: () => null,
  LineChart: () => null,
  ResponsiveContainer: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
jest.mock("../context", () => ({
  useAdsV22: () => ({
    identity: { token: "token", companyId: "company" },
    settings: {
      rules: { highFrequency: 3.5 },
      capabilities: { spend: true, profit: true, edit: mockEdit },
      tags: { hooks: [], creators: [] },
    },
  }),
  useRefreshAds: () => jest.fn(),
  useAdsQuery: (key: string[]) => ({
    data:
      key[0] === "products-v22"
        ? { products: mockProducts }
        : key[0] === "ad-detail"
          ? {
              row: mockRow,
              daily: [],
              variations: mockVariations,
              changes: [],
              capabilities: { canManageAds: mockCanManage },
            }
          : {},
    isError: false,
  }),
}));

beforeEach(() => {
  mockEdit = false;
  mockCanManage = true;
  mockProducts = [];
  mockVariations = [];
  mockRow.status = "ACTIVE";
  mockRow.effectiveStatus = "ACTIVE";
});
it("uses historical product costs even without the current catalog and ignores later catalog cost changes", () => {
  const metric = {
    ...emptySales(),
    delivered: 6,
    deliveredUnits: 6,
    eligibleDelivered: 6,
    billedRevenue: "600",
    billedUnits: 6,
    eligibleBilledUnits: 6,
    eligibleRevenue: "600",
    eligibleProductCost: "120",
    eligibleShippingCost: "60",
  };
  const summary = {
    adProducts: [{ adId: "ad", accountId: "account", productId: "product" }],
    days: [
      {
        date: "2026-10-16",
        adId: "ad",
        accountId: "account",
        storeId: "store",
        channel: "web",
        currency: "PEN",
        spend: "60",
        results: 6,
      },
    ],
    quality: { warnings: [] },
  } as unknown as AdsSummary;
  const sales = {
    totals: metric,
    byAd: [],
    byChannel: [{ ...metric, storeId: "store", channel: "web" }],
    byProduct: [{ ...metric, productId: "product", storeId: "store", channel: "web" }],
    deliveryHistory: [],
  } as unknown as AdsSales;
  const props = {
    row: mockRow,
    summary,
    sales,
    from: "2026-10-01",
    to: "2026-10-16",
    average: { hook: null, hold: null, ctr: null, conversion: null },
    onClose: jest.fn(),
    onAction: jest.fn(),
  };
  mockProducts = [];
  const view = render(<AdvertisingAdDetail {...props} />);
  expect(screen.getByText("Máximo").parentElement).toHaveTextContent("70.00");
  mockProducts = [
    {
      id: "product",
      name: "Producto",
      storeId: "store",
      unitCost: "999",
      netPrice: null,
      availableStock: "30",
      variants: [],
    },
  ];
  view.rerender(<AdvertisingAdDetail {...props} />);
  expect(screen.getByText("Máximo").parentElement).toHaveTextContent("70.00");
  expect(screen.getByText("Ganancia").parentElement).toHaveTextContent("360.00");
});

it.each([
  ["CAMPAIGN_PAUSED", "Pausado por la campaña"],
  ["ADSET_PAUSED", "Pausado por el conjunto"],
])(
  "explains inherited pause %s without changing the active child's action target",
  (effectiveStatus, label) => {
    mockRow.effectiveStatus = effectiveStatus;
    mockEdit = true;
    const onAction = jest.fn();
    render(
      <AdvertisingAdDetail
        row={mockRow}
        summary={{ adProducts: [], days: [], quality: { warnings: [] } } as unknown as AdsSummary}
        sales={
          {
            totals: emptySales(),
            byAd: [],
            byChannel: [],
            byProduct: [],
            deliveryHistory: [],
          } as unknown as AdsSales
        }
        from="2026-10-01"
        to="2026-10-16"
        average={{ hook: null, hold: null, ctr: null, conversion: null }}
        onClose={jest.fn()}
        onAction={onAction}
      />,
    );
    expect(screen.getByText(new RegExp(label), { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(effectiveStatus))).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activar" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    expect(onAction).toHaveBeenCalledWith({ rows: [mockRow], action: "pause", canManageAds: true });
  },
);

it.each([false, undefined])(
  "keeps local editing separate from unavailable Meta management (%s)",
  (canManageAds) => {
    mockEdit = true;
    mockCanManage = canManageAds;
    render(
      <AdvertisingAdDetail
        row={mockRow}
        summary={{ adProducts: [], days: [], quality: { warnings: [] } } as unknown as AdsSummary}
        sales={
          {
            totals: emptySales(),
            byAd: [],
            byChannel: [],
            byProduct: [],
            deliveryHistory: [],
          } as unknown as AdsSales
        }
        from="2026-10-01"
        to="2026-10-16"
        average={{ hook: null, hold: null, ctr: null, conversion: null }}
        onClose={jest.fn()}
        onAction={jest.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Pausar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Presupuesto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Crear variación/ })).not.toBeInTheDocument();
    expect(screen.getByText(/No hay acceso confirmado/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Tipo de gancho" })).toBeEnabled();
  },
);
it("opens the known Meta creative without commercial data and leaves every sale-derived metric unknown", () => {
  mockEdit = true;
  const view = render(
    <AdvertisingAdDetail
      row={mockRow}
      from="2026-10-01"
      to="2026-10-16"
      average={{ hook: null, hold: null, ctr: null, conversion: null }}
      onClose={jest.fn()}
      onAction={jest.fn()}
    />,
  );
  expect(screen.getByRole("heading", { name: "Vista previa real de Meta" })).toBeInTheDocument();
  expect(
    screen.getByText(/Las ventas y la rentabilidad aún no se han podido consultar/),
  ).toBeInTheDocument();
  expect(screen.getByText("Gasto", { selector: "p" }).parentElement).toHaveTextContent(
    /S\/\s*60\.00/,
  );
  for (const label of ["Ventas", "Costo por venta", "ROAS", "Máximo", "Ganancia"]) {
    expect(screen.getByText(label, { exact: true }).parentElement).toHaveTextContent("—");
    expect(screen.getByText(label, { exact: true }).parentElement).not.toHaveTextContent(
      /S\/\s*0\.00/,
    );
  }
  expect(screen.getByRole("combobox", { name: "Tipo de gancho" })).toBeDisabled();
  view.unmount();
});

it("keeps missing estimated sales unknown and does not declare the ad works", () => {
  const summary = {
    adProducts: [],
    days: [
      {
        date: "2026-10-16",
        adId: "ad",
        accountId: "account",
        storeId: "store",
        channel: "web",
        currency: "PEN",
        spend: "60",
        results: null,
      },
    ],
    quality: { warnings: [] },
  } as unknown as AdsSummary;
  const sales = {
    totals: emptySales(),
    byAd: [],
    byChannel: [{ ...emptySales(), storeId: "store", channel: "web" }],
    byProduct: [],
    deliveryHistory: [],
  } as unknown as AdsSales;
  render(
    <AdvertisingAdDetail
      row={mockRow}
      summary={summary}
      sales={sales}
      from="2026-10-01"
      to="2026-10-25"
      average={{ hook: null, hold: null, ctr: null, conversion: null }}
      onClose={jest.fn()}
      onAction={jest.fn()}
    />,
  );
  expect(screen.getByText("Ventas", { exact: true }).parentElement).toHaveTextContent("—");
  expect(screen.getByText("Ventas", { exact: true }).parentElement).not.toHaveTextContent("0");
  expect(screen.getByText(/Faltan resultados de Meta/)).toBeInTheDocument();
  expect(screen.getAllByText(/Datos incompletos: confirma las ventas/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/Funciona:/)).not.toBeInTheDocument();
});

it("shows a known original only once when the API includes it in the creative family", () => {
  mockVariations = [
    { ...mockRow, variationType: "original" },
    {
      ...mockRow,
      id: "variation",
      name: "Nuevo creativo",
      parentAdId: mockRow.id,
      variationType: "media",
    },
  ];
  render(
    <AdvertisingAdDetail
      row={mockRow}
      from="2026-10-01"
      to="2026-10-25"
      average={{ hook: null, hold: null, ctr: null, conversion: null }}
      onClose={jest.fn()}
      onAction={jest.fn()}
    />,
  );
  expect(screen.getAllByText("Anuncio real · original")).toHaveLength(1);
  expect(screen.getByText("Nuevo creativo · variación")).toBeInTheDocument();
  expect(screen.queryByText("Anuncio real · variación")).not.toBeInTheDocument();
});

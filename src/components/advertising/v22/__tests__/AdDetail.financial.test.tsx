import { fireEvent, render, screen } from "@testing-library/react";
import { AdvertisingAdDetail } from "../AdDetail";
import { emptySales } from "../model";
import type { AdsProduct, AdsRow, AdsSales, AdsSummary } from "@/services/advertisingV22Service";

let mockProducts: AdsProduct[] = [];
let mockEdit = false;
let mockSpend = true;
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
      capabilities: { spend: mockSpend, profit: true, edit: mockEdit },
      tags: { hooks: [], creators: [] },
    },
  }),
  useRefreshAds: () => jest.fn(),
  useAdsQuery: (key: string[]) => ({
    data:
      key[0] === "products-v22"
        ? { products: mockProducts }
        : key[0] === "ad-detail"
          ? { row: mockRow, daily: [], variations: [], changes: [] }
          : {},
    isError: false,
  }),
}));

beforeEach(() => {
  mockEdit = false;
  mockSpend = true;
  mockProducts = [];
  mockRow.status = "ACTIVE";
  mockRow.effectiveStatus = "ACTIVE";
  mockRow.currency = "PEN";
  mockRow.insights = { ...mockRow.insights, spend: "60", cpm: "2" };
});
it("formats USD detail and creative variations in USD, and keeps spend hidden without permission", () => {
  mockRow.currency = "USD";
  const props = {
    row: mockRow,
    summary: { adProducts: [], days: [], quality: { warnings: [] } } as unknown as AdsSummary,
    sales: {
      totals: emptySales(),
      byAd: [],
      byChannel: [],
      byProduct: [],
      deliveryHistory: [],
    } as unknown as AdsSales,
    from: "2026-10-01",
    to: "2026-10-16",
    average: { hook: null, hold: null, ctr: null, conversion: null },
    onClose: jest.fn(),
    onAction: jest.fn(),
  };
  const view = render(<AdvertisingAdDetail {...props} />);
  expect(screen.getAllByText("Gasto")[0].parentElement).toHaveTextContent(/USD.*60\.00/);
  expect(screen.getByText(/CPM/)).toHaveTextContent(/CPM USD.*2\.00/);
  expect(screen.getByText("Anuncio real · original").parentElement).toHaveTextContent(
    /USD.*60\.00/,
  );
  expect(screen.queryByText(/S\/.*60\.00/)).not.toBeInTheDocument();
  mockSpend = false;
  view.rerender(<AdvertisingAdDetail {...props} />);
  expect(screen.queryByText("Gasto")).not.toBeInTheDocument();
  expect(screen.queryByText(/USD/)).not.toBeInTheDocument();
  expect(screen.getByText(/CTR enlace/)).not.toHaveTextContent("CPM");
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
    expect(onAction).toHaveBeenCalledWith({ rows: [mockRow], action: "pause" });
  },
);

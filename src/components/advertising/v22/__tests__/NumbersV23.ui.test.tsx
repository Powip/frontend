import { fireEvent, render, screen, within } from "@testing-library/react";
import type { AdsSalesV23, AdsSummaryV23, SalesRowV23 } from "@/services/advertisingV23Service";
import { AdvertisingNumbersV23 } from "../NumbersV23";
import { emptySales } from "../model";
import { totalV23 } from "../v23-model";
let mockFrom = "2026-10-01",
  mockTo = "2026-10-31",
  mockStore = "all",
  mockAccount = "all";
let mockSpend = true,
  mockProfit = true;
let mockData: { summary: AdsSummaryV23; sales: AdsSalesV23 };
const mockKeys: unknown[][] = [];
const mockSetAccount = jest.fn();
const stores = [
  { id: "store", name: "KUNCA" },
  { id: "other", name: "LIVII" },
];
jest.mock("@/contexts/AdminPeriodContext", () => ({
  useAdminPeriod: () => ({ fromDate: mockFrom, toDate: mockTo }),
}));
jest.mock("../../AdvertisingStoreFilterContext", () => ({
  useAdvertisingStoreFilter: () => ({ storeId: mockStore, stores }),
}));
jest.mock("../../AdvertisingAccountFilterContext", () => ({
  useAdvertisingAccountFilter: () => ({ accountId: mockAccount, setAccountId: mockSetAccount }),
}));
jest.mock("../context", () => ({
  useAdsV22: () => ({ settings: { capabilities: { spend: mockSpend, profit: mockProfit } } }),
  useAdsQuery: (key: unknown[]) => {
    mockKeys.push(key);
    return { data: key[0] === "products-v22" ? { products: [] } : mockData, isError: false };
  },
}));
jest.mock("../MonthlyV23", () => ({
  MonthlyNumbersV23: (props: object) => (
    <div data-testid="monthly-context">{JSON.stringify(props)}</div>
  ),
}));
jest.mock("../ProductsV23", () => ({
  ProductsV23: (props: { storeId: string; accountId: string }) => (
    <div data-testid="product-context">
      {props.storeId}:{props.accountId}
    </div>
  ),
}));
jest.mock("../Numbers", () => ({ DailyPace: () => <div data-testid="daily-pace" /> }));
jest.mock("recharts", () => ({
  Bar: () => null,
  CartesianGrid: () => null,
  ComposedChart: () => null,
  Line: () => null,
  ResponsiveContainer: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
function row(overrides: Partial<SalesRowV23> = {}): SalesRowV23 {
  return {
    ...emptySales(),
    date: "2026-10-10",
    storeId: "store",
    channel: "WHATSAPP",
    channelFamily: "messages",
    accountId: "a",
    adId: "ad",
    sellerId: "alice",
    sellerName: "Alice",
    orders: 2,
    ordersNet: 2,
    units: 3,
    confirmed: 1,
    delivered: 1,
    deliveredUnits: 2,
    normalOrders: 2,
    normalConfirmed: 1,
    convertedCodOrders: 0,
    unattributedOrders: 0,
    missingSellerOrders: 0,
    adjustmentOrders: 0,
    adjustmentRevenue: "0",
    unknownAdjustmentAmounts: 0,
    orderRevenue: "300",
    orderRevenueNet: "300",
    billedRevenue: "200",
    deliveredRevenue: "200",
    eligibleRevenue: "200",
    eligibleProductCost: "50",
    eligibleShippingCost: "20",
    eligibleDelivered: 1,
    eligibleDeliveredUnits: 2,
    completeCostOrders: 1,
    ...overrides,
  };
}
const card = (label: string) =>
  screen.getAllByText(label, { exact: true }).find((node) => node.tagName === "P")!.parentElement!;
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-25T10:00:00-05:00"));
  mockFrom = "2026-10-01";
  mockTo = "2026-10-31";
  mockStore = mockAccount = "all";
  mockSpend = mockProfit = true;
  mockKeys.length = 0;
  mockSetAccount.mockReset();
  const rows = [
    row(),
    row({
      storeId: "other",
      accountId: "b",
      adId: "other-ad",
      sellerId: "bob",
      sellerName: "Bob",
      orders: 4,
      ordersNet: 4,
      units: 4,
    }),
  ];
  const summary = {
    from: mockFrom,
    to: "2026-10-25",
    today: "2026-10-25",
    stores,
    channels: [],
    sellers: [
      { id: "alice", name: "Alice" },
      { id: "bob", name: "Bob" },
    ],
    accounts: [
      { id: "a", name: "Cuenta A" },
      { id: "b", name: "Cuenta B" },
    ],
    days: rows.map((r, index) => ({
      date: r.date,
      storeId: r.storeId,
      accountId: r.accountId,
      adId: r.adId,
      adsetId: "set",
      campaignId: "campaign",
      currency: "PEN",
      channel: "messages",
      channelExact: "wa",
      sellerId: r.sellerId,
      spend: index ? "60" : "100",
      results: 10,
    })),
    adProducts: [],
    quality: { warnings: [], spendAvailable: true },
    unassignedSpend: "0",
    settings: { rules: { nearLimitPct: 70 }, capabilities: { spend: true, profit: true } },
  } as AdsSummaryV23;
  const sales = {
    daily: rows,
    byAd: rows,
    byStore: [],
    byChannel: [],
    bySeller: [],
    byProduct: [],
    totals: totalV23(rows),
    adjustments: [],
    shopifyCod: null,
    deliveryHistory: [],
    deliveredActivity: { daily: [row({ delivered: 7, deliveredRevenue: "700" })] },
  } as AdsSalesV23;
  mockData = { summary, sales };
});
afterEach(() => jest.useRealTimers());
it("uses the selected period for cards while retaining all stores in the comparison", () => {
  mockStore = "store";
  render(<AdvertisingNumbersV23 />);
  expect(
    screen.getByRole("heading", { name: "Mis números · Publicidad v2.3" }),
  ).toBeInTheDocument();
  expect(card("Pedidos ingresados")).toHaveTextContent("2");
  expect(card("Gasto en publicidad")).toHaveTextContent(/S\/\s*100\.00/);
  const comparison = screen.getByRole("heading", { name: "Cuánto me cuesta vender" }).parentElement!
    .parentElement!;
  expect(within(comparison).getByRole("columnheader", { name: "KUNCA" })).toBeInTheDocument();
  expect(within(comparison).getByRole("columnheader", { name: "LIVII" })).toBeInTheDocument();
  const orderRow = within(comparison).getByText("Pedidos ingresados", { exact: true })
    .parentElement!;
  expect(
    within(orderRow)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(["2", "4", "6"]);
  expect(screen.queryByRole("heading", { name: /Entregado hoy/ })).not.toBeInTheDocument();
  expect(mockKeys).toContainEqual(["numbers-v23", "2026-10-01", "2026-10-25"]);
  expect(mockKeys).toContainEqual(["numbers-v23", "2026-09-01", "2026-09-25"]);
});
it("shows daily delivery activity separately and forwards the global account to monthly and product views", () => {
  mockFrom = mockTo = "2026-10-10";
  mockAccount = "a";
  render(<AdvertisingNumbersV23 />);
  expect(
    screen.getByRole("heading", { name: "Reporte del día · 10 de octubre" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Entregado hoy · actividad de la fecha elegida" }),
  ).toBeInTheDocument();
  expect(card("Pedidos entregados ese día")).toHaveTextContent("7");
  expect(card("Ventas entregadas")).toHaveTextContent("1");
  expect(screen.getByTestId("monthly-context")).toHaveTextContent('"accountId":"a"');
  expect(screen.getByTestId("product-context")).toHaveTextContent("all:a");
  fireEvent.click(screen.getByRole("button", { name: "Cuenta B" }));
  expect(mockSetAccount).toHaveBeenCalledWith("b");
});
it("hides COD entirely outside an enabled store and shows it only in the enabled business", () => {
  mockData.sales.shopifyCod = {
    enabled: true,
    storeIds: ["store"],
    daily: [],
    leadsDaily: [],
    byAssignedSeller: [],
    leads: 0,
    converted: 0,
  } as unknown as NonNullable<AdsSalesV23["shopifyCod"]>;
  mockStore = "other";
  const view = render(<AdvertisingNumbersV23 />);
  expect(screen.queryByRole("heading", { name: "Shopify COD · Leads" })).not.toBeInTheDocument();
  expect(screen.queryByText("Leads generados")).not.toBeInTheDocument();
  mockStore = "store";
  view.rerender(<AdvertisingNumbersV23 />);
  expect(screen.getByRole("heading", { name: "Shopify COD · Leads" })).toBeInTheDocument();
  expect(screen.getByText("Leads generados")).toBeInTheDocument();
});
it("keeps daily delivery totals pending when historic delivered orders have no event date",()=>{
  mockFrom=mockTo="2026-10-10";mockStore="store";
  mockData.sales.deliveredActivity.missingDatesByStore=[{storeId:"store",orders:2}];
  render(<AdvertisingNumbersV23/>);
  expect(card("Pedidos entregados ese día")).toHaveTextContent("—");
  expect(card("Facturación entregada ese día")).toHaveTextContent("—");
  expect(screen.getByText(/Se identificaron 7 entregas fechadas/)).toBeInTheDocument();
  expect(card("Ventas entregadas")).toHaveTextContent("1");
});
it("hides spend, product costs and profitability for roles without those permissions", () => {
  mockSpend = mockProfit = false;
  render(<AdvertisingNumbersV23 />);
  expect(screen.queryByText("Gasto en publicidad", { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "¿Es rentable?" })).not.toBeInTheDocument();
  expect(screen.queryByText("Lo máximo por venta", { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText("Ganancia", { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "Gasto" })).not.toBeInTheDocument();
  expect(card("Facturación ingresada")).toHaveTextContent(/S\/\s*600\.00/);
  expect(screen.queryByTestId("daily-pace")).not.toBeInTheDocument();
});

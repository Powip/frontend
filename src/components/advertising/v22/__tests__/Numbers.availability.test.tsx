import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { adsGet, getAdsSales, type AdsSales, type AdsSummary } from "@/services/advertisingV22Service";
import { useAdvertisingStoreFilter } from "../../AdvertisingStoreFilterContext";
import { useAdsQuery, useAdsV22 } from "../context";
import { emptySales } from "../model";
import { AdvertisingNumbers, MonthlyNumbers } from "../Numbers";
import { exportAdsWorkbook } from "../shared";

jest.mock("../context", () => ({ useAdsQuery: jest.fn(), useAdsV22: jest.fn() }));
jest.mock("../../AdvertisingStoreFilterContext", () => ({ useAdvertisingStoreFilter: jest.fn() }));
jest.mock("@/services/advertisingV22Service", () => ({
  ...jest.requireActual("@/services/advertisingV22Service"),
  adsGet: jest.fn(),
  getAdsSales: jest.fn(),
}));
jest.mock("../shared", () => ({
  ...jest.requireActual("../shared"),
  exportAdsWorkbook: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/contexts/AdminPeriodContext", () => ({
  useAdminPeriod: () => ({ fromDate: "2026-10-01", toDate: "2026-10-02", setPeriod: jest.fn() }),
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../model", () => ({
  ...jest.requireActual("../model"),
  limaToday: () => "2026-10-03",
}));
jest.mock("recharts", () => {
  const container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: container,
    ComposedChart: container,
    Bar: container,
    CartesianGrid: () => null,
    Cell: () => null,
    Line: () => null,
    ReferenceLine: () => null,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});

it("requests the selected business for the period, comparison and product context", async () => {
  render(<AdvertisingNumbers />);
  const requests = jest.mocked(useAdsQuery).mock.calls;
  const numbers = requests.filter(([key]) => key[0] === "numbers" && ["period", "comparison"].includes(String(key[1])));
  expect(numbers.map(([key]) => key.at(-1))).toEqual(["store", "store"]);
  expect(requests.some(([key]) => key[0] === "products-v22" && key[1] === "store")).toBe(true);
  jest.mocked(adsGet).mockResolvedValue(source);
  jest.mocked(getAdsSales).mockResolvedValue(orders);
  const identity = { token: "token", companyId: "company" };
  const signal = new AbortController().signal;
  await numbers[0][1](identity, signal);
  expect(jest.mocked(getAdsSales).mock.calls.every((call) => call[3] === "store")).toBe(true);
  expect(jest.mocked(adsGet).mock.calls.filter((call) => call[1] === "/v22/summary").every((call) => call[2]?.storeId === "store")).toBe(true);
});

let source: AdsSummary;
let orders: AdsSales;
beforeEach(() => {
  jest.clearAllMocks();
  const metric = {
    ...emptySales(),
    orders: 1,
    delivered: 1,
    deliveredUnits: 1,
    billedRevenue: "100",
    eligibleRevenue: "0",
    eligibleProductCost: null,
    eligibleShippingCost: null,
    missingCostOrders: 1,
  };
  source = {
    source: "powip-advertising-v22",
    from: "2026-10-01",
    to: "2026-10-02",
    today: "2026-10-03",
    timeZone: "America/Lima",
    currency: "PEN",
    stores: [{ id: "store", name: "Tienda" }],
    channels: [],
    days: [],
    unassignedSpend: null,
    adProducts: [],
    settings: {
      version: 1,
      rules: {
        noResultsDays: 3,
        minSpend: "60",
        nearLimitPct: 70,
        highFrequency: 3.5,
        winPct: 60,
        testMultiplier: 2,
        testMinSales: 3,
      },
      budgets: [],
      whatsapp: { enabled: false, time: "08:00", numbers: [], includes: [] },
      permissions: [],
      tags: { hooks: [], creators: [] },
      capabilities: { view: true, spend: true, profit: true, edit: true, configure: true },
    },
    quality: {
      warnings: [],
      spendAvailable: false,
      coverage: "partial",
      spendScopes: [
        {
          storeId: "store",
          currency: "PEN",
          spendAvailable: false,
          coverage: "partial",
          reasons: ["META_SPEND_MISMATCH"],
          days: [
            {
              date: "2026-10-01",
              spendAvailable: true,
              coverage: "complete",
              reasons: [],
              accountIds: ["account"],
            },
            {
              date: "2026-10-02",
              spendAvailable: false,
              coverage: "pending",
              reasons: ["META_SPEND_MISMATCH"],
              accountIds: ["account"],
            },
          ],
        },
      ],
    },
  };
  orders = {
    source: "powip-orders-v22",
    from: source.from,
    to: source.to,
    currency: "PEN",
    totals: metric,
    byStore: [{ ...metric, storeId: "store" }],
    byChannel: [{ ...metric, storeId: "store", channel: "web" }],
    byProduct: [],
    byAd: [],
    daily: [{ ...metric, date: "2026-10-01", storeId: "store", channel: "web" }],
    deliveryHistory: [],
    productVelocity: [],
    quality: {},
  };
  jest.mocked(useAdvertisingStoreFilter).mockReturnValue({
    storeId: "store",
    defaultStoreId: "store",
    setStoreId: jest.fn(),
    stores: source.stores,
  });
  jest
    .mocked(useAdsV22)
    .mockReturnValue({ settings: source.settings } as ReturnType<typeof useAdsV22>);
  jest.mocked(useAdsQuery).mockImplementation(
    (key) =>
      ({
        data:
          key[0] === "numbers"
            ? { summary: source, sales: orders }
            : key[0] === "pace-budgets"
              ? { rows: [] }
              : { products: [] },
        isError: false,
        refetch: jest.fn(),
      }) as ReturnType<typeof useAdsQuery>,
  );
});

it("filters the comparison and its export to the selected store, including channel totals", async () => {
  const user = userEvent.setup();
  const other = { ...orders.byChannel[0], storeId: "other", orders: 9 };
  source.stores.push({ id: "other", name: "Otra tienda" });
  orders.byChannel.push(other);
  render(<AdvertisingNumbers />);
  const comparison = screen.getByRole("columnheader", { name: "Métrica" }).closest("table")!;
  expect(
    within(comparison)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent),
  ).toEqual(["Métrica", "Tienda"]);
  expect(within(comparison).queryByText("Gasto sin tienda →")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Desglosar por canal" }));
  expect(
    within(comparison)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent),
  ).toEqual(["Métrica", "Mensajes", "Web", "Tienda"]);
  const ordersRow = within(comparison).getByRole("rowheader", { name: "Pedidos" }).closest("tr")!;
  expect(
    within(ordersRow)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(["0", "1", "1"]);
  const tools = screen.getByRole("heading", { name: "Cuánto me cuesta vender" }).parentElement!;
  await user.click(within(tools).getByRole("button", { name: "↓ Excel" }));
  const sheets = jest.mocked(exportAdsWorkbook).mock.calls[0][1];
  expect(sheets[0].rows.find((row) => row.Métrica === "Pedidos")).toEqual({
    Métrica: "Pedidos",
    Mensajes: 0,
    Web: 1,
    Tienda: 1,
  });
});

it("shows one business total rather than separate store columns", () => {
  source.stores.push({ id: "other", name: "Otra tienda" });
  orders.byChannel.push({ ...orders.byChannel[0], storeId: "other", orders: 9 });
  jest.mocked(useAdvertisingStoreFilter).mockReturnValue({
    storeId: "all",
    defaultStoreId: "store",
    setStoreId: jest.fn(),
    stores: source.stores,
  });
  render(<AdvertisingNumbers />);
  const comparison = screen.getByRole("columnheader", { name: "Métrica" }).closest("table")!;
  expect(
    within(comparison)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent),
  ).toEqual(["Métrica", "Todo el negocio"]);
  const ordersRow = within(comparison).getByRole("rowheader", { name: "Pedidos" }).closest("tr")!;
  expect(
    within(ordersRow)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(["10"]);
  expect(within(comparison).getByText("Gasto sin tienda →")).toBeInTheDocument();
});

it("keeps the 76 advertising orders separate from 9 other-channel records and links to Sales", async () => {
  const metric = { ...orders.totals, orders: 76, billedRevenue: "4327.94" };
  orders.totals = metric;
  orders.byChannel = [
    { ...metric, storeId: "store", channel: "messages", orders: 62, billedRevenue: "3925.19" },
    { ...metric, storeId: "store", channel: "web", orders: 14, billedRevenue: "402.75" },
    // The source group includes 7 INCOMPLETE records and 2 visible Sales orders,
    // but does not expose the status split to the frontend.
    { ...emptySales(), storeId: "store", channel: "other", orders: 9 },
  ];
  jest.mocked(useAdvertisingStoreFilter).mockReturnValue({
    storeId: "all",
    defaultStoreId: "all",
    setStoreId: jest.fn(),
    stores: source.stores,
  });
  const user = userEvent.setup();
  render(<AdvertisingNumbers />);
  const comparison = screen.getByRole("columnheader", { name: "Métrica" }).closest("table")!;
  const ordersRow = within(comparison).getByRole("rowheader", { name: "Pedidos" }).closest("tr")!;
  expect(within(ordersRow).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["76"]);
  const billedCard = screen.getByText("Facturado (entregado)").parentElement!;
  expect(billedCard).toHaveTextContent(/4,327\.94/);
  expect(screen.queryByText("Otros canales sin publicidad · pedidos")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Revisar otros canales en Ventas" })).toHaveAttribute(
    "href",
    "/ventas",
  );
  await user.click(screen.getByRole("button", { name: "Desglosar por canal" }));
  expect(within(ordersRow).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
    "62",
    "14",
    "76",
  ]);
  expect(within(comparison).queryByText("9")).not.toBeInTheDocument();
});

it("exports the complete business and offers channel detail without splitting stores", async () => {
  source.stores.push({ id: "other", name: "Otra tienda" });
  orders.byChannel.push({
    ...orders.byChannel[0],
    storeId: "other",
    channel: "messages",
    orders: 9,
  });
  jest.mocked(useAdvertisingStoreFilter).mockReturnValue({
    storeId: "all",
    defaultStoreId: "all",
    setStoreId: jest.fn(),
    stores: source.stores,
  });
  const user = userEvent.setup();
  render(<AdvertisingNumbers />);
  const comparison = screen.getByRole("columnheader", { name: "Métrica" }).closest("table")!;
  await user.click(screen.getByRole("button", { name: "Desglosar por canal" }));
  expect(
    within(comparison)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent),
  ).toEqual(["Métrica", "Mensajes", "Web", "Todo el negocio"]);
  const tools = screen.getByRole("heading", { name: "Cuánto me cuesta vender" }).parentElement!;
  await user.click(within(tools).getByRole("button", { name: "↓ Excel" }));
  const sheets = jest.mocked(exportAdsWorkbook).mock.calls[0][1];
  expect(sheets[0].rows.find((row) => row.Métrica === "Pedidos")).toEqual({
    Métrica: "Pedidos",
    Mensajes: 9,
    Web: 1,
    "Todo el negocio": 10,
  });
});

it("explains the monthly scope separately and distinguishes unevaluable days", () => {
  render(<MonthlyNumbers />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "Detalle de Meta por conciliar para 2026-10-01 a 2026-10-03",
  );
  const days = screen.getByText("Días sin pérdida").parentElement;
  expect(days).not.toBeNull();
  expect(within(days as HTMLElement).getByText("—")).toBeInTheDocument();
  expect(within(days as HTMLElement).getByText(/2 días con datos pendientes/)).toBeInTheDocument();
});

it("sends historical cost review to orders while preserving store and dates", () => {
  render(<AdvertisingNumbers />);
  const link = screen.getByRole("link", { name: "Revisar costos de los pedidos →" });
  const url = new URL(link.getAttribute("href") ?? "", "https://example.test");
  expect(url.pathname).toBe("/publicidad/configuracion");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    from: "2026-10-01",
    to: "2026-10-02",
    storeId: "store",
    section: "sales-costs",
  });
  expect(screen.queryByRole("link", { name: "Cargar costo →" })).not.toBeInTheDocument();
});

it("does not show spend diagnostics or profit cards without financial access", () => {
  source.settings.capabilities.spend = false;
  source.settings.capabilities.profit = false;
  render(<MonthlyNumbers />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByText("Días sin pérdida")).not.toBeInTheDocument();
  expect(screen.queryByText("Gastado en el mes")).not.toBeInTheDocument();
});

it("confirms a successful clipboard copy without claiming a WhatsApp send", async () => {
  const user = userEvent.setup();
  const originalShare = Object.getOwnPropertyDescriptor(navigator, "share");
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  try {
    render(<MonthlyNumbers />);
    await user.click(screen.getByRole("button", { name: "Compartir resumen" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("POWIP · 2026-10"));
    expect(
      screen.getByText("Resumen copiado. Puedes pegarlo en WhatsApp u otra aplicación."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Compartir WhatsApp" })).not.toBeInTheDocument();
  } finally {
    if (originalShare) Object.defineProperty(navigator, "share", originalShare);
    else Reflect.deleteProperty(navigator, "share");
    if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});

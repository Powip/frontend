import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MonthlyNumbersV23 } from "../MonthlyV23";
import { emptySales } from "../model";
import { exportAdsWorkbook } from "../shared";
const push = jest.fn(),
  setPeriod = jest.fn(),
  queryMock = jest.fn();
const metric = {
  ...emptySales(),
  orders: 2,
  ordersNet: 2,
  units: 3,
  normalOrders: 2,
  normalConfirmed: 1,
  confirmed: 1,
  delivered: 1,
  deliveredUnits: 2,
  orderRevenue: "200",
  orderRevenueNet: "200",
  deliveredRevenue: "100",
  eligibleRevenue: "100",
  eligibleProductCost: "20",
  eligibleShippingCost: "10",
  eligibleDelivered: 1,
  eligibleDeliveredUnits: 2,
};
const settings = {
  rules: { nearLimitPct: 70 },
  budgets: [{ storeId: "store", month: "2026-10", amount: "1000" }],
  capabilities: { view: true, spend: true, profit: true },
};
const data = {
  summary: {
    from: "2026-10-01",
    to: "2026-10-03",
    today: "2026-10-03",
    settings,
    stores: [{ id: "store", name: "KUNCA" }],
    accounts: [{ id: "account", name: "Meta Kunca" }],
    sellers: [],
    shopifyCod: [],
    quality: { spendAvailable: true },
    days: [
      {
        date: "2026-10-01",
        accountId: "account",
        storeId: "store",
        channel: "messages",
        channelExact: "wa",
        spend: "100",
        currency: "PEN",
        results: 10,
      },
    ],
  },
  sales: {
    daily: [
      {
        ...metric,
        date: "2026-10-01",
        storeId: "store",
        channelFamily: "messages",
        channel: "WHATSAPP",
        accountId: "account",
      },
    ],
    deliveryHistory: [],
    shopifyCod: null,
  },
};
jest.mock("../context", () => ({
  useAdsQuery: (...args: unknown[]) => {
    queryMock(...args);
    return { data, isPending: false, isError: false };
  },
  useAdsV22: () => ({ settings }),
}));
jest.mock("@/contexts/AdminPeriodContext", () => ({
  useAdminPeriod: () => ({ fromDate: "2026-09-02", toDate: "2026-09-04", setPeriod }),
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("../model", () => ({ ...jest.requireActual("../model"), limaToday: () => "2026-10-03" }));
jest.mock("../shared", () => ({
  ...jest.requireActual("../shared"),
  exportAdsWorkbook: jest.fn().mockResolvedValue(undefined),
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
beforeEach(() => {
  jest.clearAllMocks();
  window.open = jest.fn();
});
describe("Publicidad v2.3 month independent from top period", () => {
  it("loads the full current month and opens an ad day with both global filters", () => {
    render(<MonthlyNumbersV23 storeId="store" accountId="account" canSpend canProfit />);
    expect(queryMock).toHaveBeenCalledWith(
      ["numbers-v23", "2026-10-01", "2026-10-03"],
      expect.any(Function),
    );
    fireEvent.click(screen.getByRole("button", { name: "jue 1 oct" }));
    expect(setPeriod).toHaveBeenCalledWith("2026-10-01", "2026-10-01");
    expect(push).toHaveBeenCalledWith(
      "/publicidad/anuncios?from=2026-10-01&to=2026-10-01&storeId=store&adAccountId=account",
    );
    expect(
      within(screen.getByRole("table")).getByText("Facturación ingresada"),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /todos los días/ })).toBeInTheDocument();
  });
  it("exports all 31 days and the official CPV/CPP columns", async () => {
    render(<MonthlyNumbersV23 storeId="store" accountId="all" canSpend canProfit />);
    fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    await waitFor(() => expect(exportAdsWorkbook).toHaveBeenCalled());
    const sheet = (exportAdsWorkbook as jest.Mock).mock.calls[0][1][0];
    expect(sheet.rows).toHaveLength(31);
    expect(sheet.rows[0]).toMatchObject({ Día: "2026-10-01", Pedidos: 2, Productos: 3, CPV: 50 });
    expect(sheet.rows[30].Gasto).toBeNull();
    expect(sheet.rows[30].Estado).toBe("Por transcurrir");
  });
  it("hides sensitive spend/profit in the screen, workbook and WhatsApp when permission is absent", () => {
    render(
      <MonthlyNumbersV23 storeId="store" accountId="all" canSpend={false} canProfit={false} />,
    );
    expect(screen.queryByText("Gastado en el mes")).not.toBeInTheDocument();
    expect(screen.queryByText("Ganancia real")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    const row = (exportAdsWorkbook as jest.Mock).mock.calls[0][1][0].rows[0];
    expect(row).not.toHaveProperty("Gasto");
    expect(row).not.toHaveProperty("CPV");
    expect(row).not.toHaveProperty("Ganancia");
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));
    const link = decodeURIComponent((window.open as jest.Mock).mock.calls[0][0]);
    expect(link).not.toContain("Gastado:");
    expect(link).not.toContain("CPV:");
    expect(link).not.toContain("Ganancia:");
  });
});

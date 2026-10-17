import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { AdvertisingTests, TestRow } from "../Tests";
import { emptySales } from "../model";
import type {
  AdsProduct,
  AdsRow,
  AdsSales,
  AdsSummary,
  AdsTest,
} from "@/services/advertisingV22Service";

const refresh = jest.fn().mockResolvedValue(undefined);
let mockProducts: AdsProduct[] = [];
let mockTests: AdsTest[] = [];
const metric = {
  ...emptySales(),
  delivered: 3,
  eligibleDelivered: 3,
  orders: 3,
  attributedOrders: 3,
  billedRevenue: "300",
  eligibleRevenue: "300",
  eligibleProductCost: "90",
  eligibleShippingCost: "30",
};
const source = {
  summary: {
    today: "2026-10-16",
    days: [
      {
        adId: "4",
        adsetId: "3",
        campaignId: "2",
        accountId: "account",
        storeId: "store",
        date: "2026-10-16",
        channel: "web",
        spend: "60",
        results: 3,
        currency: "PEN",
      },
    ],
    adProducts: [],
    quality: { warnings: [], coverage: "complete" },
  } as unknown as AdsSummary,
  sales: {
    totals: metric,
    byAd: [{ ...metric, adId: "4", storeId: "store", channel: "web" }],
    byChannel: [{ ...metric, storeId: "store", channel: "web" }],
    deliveryHistory: [],
  } as unknown as AdsSales,
};
const ad = {
  id: "4",
  accountId: "account",
  adsetId: "3",
  campaignId: "2",
  level: "ad",
  name: "Anuncio probado",
  currency: "PEN",
  store: { id: "store", name: "Tienda" },
  insights: { spend: "60" },
  budget: { objectId: "3", level: "adset", dailyBudget: "50.00" },
} as AdsRow;
jest.mock("axios");
jest.mock("../Numbers", () => ({ useNumbers: () => ({ data: source, isError: false }) }));
jest.mock("../context", () => ({
  useAdsV22: () => ({
    identity: { token: "token", companyId: "company" },
    settings: {
      rules: { testMinSales: 3, testMultiplier: 2, winPct: 60 },
      capabilities: { edit: true, spend: true, profit: true },
    },
  }),
  useRefreshAds: () => refresh,
  useAdsQuery: () => ({
    data: { rows: [ad], products: mockProducts, tests: mockTests },
    isError: false,
  }),
}));
const test: AdsTest = {
  id: "test",
  accountId: "account",
  productId: "product",
  storeId: "store",
  adIds: ["4"],
  adsetId: "3",
  startAt: "2026-10-01T05:00:00Z",
  status: "active",
};
describe("product-test decision receipt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProducts = [];
    mockTests = [];
    source.sales.byAd = [{ ...metric, adId: "4", storeId: "store", channel: "web" }];
    process.env.NEXT_PUBLIC_API_INTEGRATIONS = "https://integrations.test";
    Object.defineProperty(global.crypto, "randomUUID", {
      configurable: true,
      value: () => "7d7b6cb1-15cc-44ce-88f3-487066fd5a70",
    });
  });
  it("confirms the real Meta budget increase before marking the test scaled with the same request ID", async () => {
    (axios.request as jest.Mock).mockResolvedValue({ data: { status: "succeeded" } });
    render(<TestRow test={test} />);
    fireEvent.click(screen.getByRole("button", { name: "Pasar a escala" }));
    expect(axios.request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(
      (axios.request as jest.Mock).mock.calls.map((call) => ({
        method: call[0].method,
        path: new URL(call[0].url).pathname,
        body: call[0].data,
      })),
    ).toEqual([
      {
        method: "post",
        path: "/advertising/companies/company/meta/v22/actions",
        body: {
          requestId: "7d7b6cb1-15cc-44ce-88f3-487066fd5a70",
          accountId: "account",
          objectId: "3",
          level: "adset",
          action: "budget",
          budget: "65.00",
        },
      },
      {
        method: "patch",
        path: "/advertising/companies/company/v22/tests/test",
        body: {
          requestId: "7d7b6cb1-15cc-44ce-88f3-487066fd5a70",
          action: "scale",
          method: "budget",
        },
      },
    ]);
  });
  it("does not persist a decision when Meta did not confirm the change", async () => {
    (axios.request as jest.Mock).mockResolvedValue({ data: { status: "unknown" } });
    render(<TestRow test={test} />);
    fireEvent.click(screen.getByRole("button", { name: "Pasar a escala" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Meta no confirmó el cambio");
    expect(axios.request).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });
  it("does not classify an ad without its own product costs as a winner using another product's store margin", () => {
    source.sales.byAd = [
      {
        ...metric,
        adId: "4",
        storeId: "store",
        channel: "web",
        missingCostOrders: 3,
        eligibleDelivered: 0,
        eligibleRevenue: "0",
        eligibleProductCost: "0",
        eligibleShippingCost: "0",
      },
    ];
    render(<TestRow test={test} />);
    expect(screen.getByText(/Sin costo suficiente/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pasar a escala" })).not.toBeInTheDocument();
    expect(axios.request).not.toHaveBeenCalled();
  });
  it("requires a commercial store before creating a test from the all-stores scope", () => {
    render(<AdvertisingTests />);
    expect(screen.getByRole("button", { name: "Nueva prueba" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Selecciona una tienda comercial");
  });
  it("resolves test product names from the company catalog independently of its warehouse store", () => {
    mockProducts = [
      {
        id: "product",
        name: "Producto compartido",
        storeId: "warehouse",
        unitCost: "10",
        netPrice: null,
        availableStock: "20",
        variants: [],
      },
    ] as AdsProduct[];
    mockTests = [test];
    render(<AdvertisingTests />);
    expect(screen.getByText("Producto compartido")).toBeInTheDocument();
  });
});

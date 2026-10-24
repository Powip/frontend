import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { AdvertisingTests, TestRow } from "../Tests";
import { AdvertisingStoreFilterProvider } from "../../AdvertisingStoreFilterContext";
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
let mockProfit = true;
let mockSpend = true;
let mockProductErrorStoreId: string | null = null;
const mockQueries: Array<{
  key: unknown[];
  request: (identity: { companyId: string; token: string }, signal: AbortSignal) => Promise<unknown>;
  enabled: boolean;
}> = [];
const metric = {
  ...emptySales(),
  delivered: 3,
  deliveredUnits: 3,
  billedUnits: 3,
  eligibleBilledUnits: 3,
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
    adProducts: [
      { adId: "4", accountId: "account", productId: "product", storeId: "store", origin: "manual" },
    ],
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
let mockAds = [ad];
jest.mock("axios");
jest.mock("../Numbers", () => ({ useNumbers: () => ({ data: source, isError: false }) }));
jest.mock("../context", () => ({
  useAdsV22: () => ({
    identity: { token: "token", companyId: "company" },
    settings: {
      rules: { testMinSales: 3, testMultiplier: 2, winPct: 60 },
      capabilities: { edit: true, spend: mockSpend, profit: mockProfit },
    },
  }),
  useRefreshAds: () => refresh,
  useAdsQuery: (key: unknown[], request: (identity: { companyId: string; token: string }, signal: AbortSignal) => Promise<unknown>, enabled = true) => {
    mockQueries.push({ key, request, enabled });
    return {
      data: { rows: mockAds, products: mockProducts, tests: mockTests },
      isError: key[0] === "test-create-products" && key[1] === mockProductErrorStoreId,
      error: new Error("No se pudieron consultar los productos"),
    };
  },
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
    mockProfit = true;
    mockSpend = true;
    ad.currency = "PEN";
    ad.insights.spend = "60";
    mockAds = [ad];
    source.summary.days = [{ ...source.summary.days[0], currency: "PEN" }];
    mockProductErrorStoreId = null;
    mockQueries.length = 0;
    window.history.replaceState({}, "", "/");
    source.sales.byAd = [{ ...metric, adId: "4", storeId: "store", channel: "web" }];
    process.env.NEXT_PUBLIC_API_INTEGRATIONS = "https://integrations.test";
    Object.defineProperty(global.crypto, "randomUUID", {
      configurable: true,
      value: () => "7d7b6cb1-15cc-44ce-88f3-487066fd5a70",
    });
  });
  it("shows USD test spend and CPA in USD without a PEN profitability verdict", () => {
    ad.currency = "USD";
    source.summary.days[0].currency = "USD";
    render(<TestRow test={test} />);
    expect(screen.getByText("Gasto").textContent).toMatch(/USD.*60\.00/);
    expect(screen.getByText("C. venta").textContent).toMatch(/USD.*20\.00/);
    expect(screen.getByText(/Datos incompletos/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pasar a escala" })).not.toBeInTheDocument();
  });
  it("suppresses a mixed-currency or unknown test total and retains spend permissions", () => {
    mockAds = [ad, { ...ad, id: "5", currency: "USD" }];
    const view = render(<TestRow test={{ ...test, adIds: ["4", "5"] }} />);
    expect(screen.getByText("Gasto")).toHaveTextContent("Gasto —");
    expect(screen.getByText("C. venta")).toHaveTextContent("C. venta —");
    mockAds = [ad];
    ad.insights.spend = null;
    view.rerender(<TestRow test={test} />);
    expect(screen.getByText("Gasto")).toHaveTextContent("Gasto —");
    mockSpend = false;
    view.rerender(<TestRow test={test} />);
    expect(screen.queryByText("Gasto")).not.toBeInTheDocument();
    expect(screen.queryByText("C. venta")).not.toBeInTheDocument();
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
  it("requires at least one commercial store before opening test creation", () => {
    render(<AdvertisingTests />);
    expect(screen.getByRole("button", { name: "Nueva prueba" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Configura una tienda comercial");
  });
  it("keeps the business list unfiltered and requires an explicit local store to create a test", async () => {
    mockProducts = [{ id: "product", name: "Producto compartido", storeId: "warehouse", canTest: true, unitCost: "10", variants: [] } as unknown as AdsProduct];
    (axios.request as jest.Mock).mockResolvedValue({ data: { id: "created-test" } });
    (axios.get as jest.Mock).mockResolvedValue({ data: { products: mockProducts } });
    render(
      <AdvertisingStoreFilterProvider
        stores={[{ id: "store", name: "Tienda comercial" }, { id: "other-store", name: "Otra tienda" }]}
        initialStoreId="all"
      ><AdvertisingTests /></AdvertisingStoreFilterProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Nueva prueba" }));
    expect(screen.getByRole("combobox", { name: "Tienda de la prueba" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Producto con costo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Crear prueba" })).toBeDisabled();
    expect(mockQueries.filter((query) => query.key[0] === "test-create-products").every((query) => !query.enabled)).toBe(true);
    fireEvent.change(screen.getByRole("combobox", { name: "Tienda de la prueba" }), { target: { value: "store" } });
    expect(window.location.search).toBe("");
    const productQuery = mockQueries.filter((query) => query.key[0] === "test-create-products" && query.enabled).at(-1)!;
    await productQuery.request({ companyId: "company", token: "token" }, new AbortController().signal);
    expect(axios.get).toHaveBeenCalledWith(
      "https://integrations.test/advertising/companies/company/v22/products",
      expect.objectContaining({ params: { storeId: "store" } }),
    );
    expect(mockQueries.filter((query) => query.key[0] === "tests").every((query) => query.key[1] === "all")).toBe(true);
    expect(mockQueries.filter((query) => query.key[0] === "tests-catalog" && query.enabled).every((query) => query.key[1] === "store")).toBe(true);
    fireEvent.change(screen.getByRole("combobox", { name: "Producto con costo" }), { target: { value: "product" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Conjunto de anuncios" }), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear prueba" }));
    await waitFor(() => expect(axios.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "post",
      data: expect.objectContaining({ storeId: "store", productId: "product", accountId: "account", adIds: ["4"] }),
    })));
  });
  it("clears a local test selection on store changes without changing the business filter", () => {
    mockProducts = [{ id: "product", name: "Producto", storeId: "warehouse", canTest: true, variants: [] } as unknown as AdsProduct];
    render(
      <AdvertisingStoreFilterProvider stores={[{ id: "store", name: "Primera" }, { id: "other-store", name: "Segunda" }]} initialStoreId="all">
        <AdvertisingTests />
      </AdvertisingStoreFilterProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Nueva prueba" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Tienda de la prueba" }), { target: { value: "store" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Producto con costo" }), { target: { value: "product" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Conjunto de anuncios" }), { target: { value: "3" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Tienda de la prueba" }), { target: { value: "other-store" } });
    expect(screen.getByRole("combobox", { name: "Producto con costo" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Conjunto de anuncios" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Crear prueba" })).toBeDisabled();
    expect(axios.request).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });
  it("keeps the local store choice available after a product query fails", () => {
    mockProductErrorStoreId = "store";
    render(
      <AdvertisingStoreFilterProvider stores={[{ id: "store", name: "Primera" }, { id: "other-store", name: "Segunda" }]} initialStoreId="all">
        <AdvertisingTests />
      </AdvertisingStoreFilterProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Nueva prueba" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Tienda de la prueba" }), { target: { value: "store" } });
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron consultar los productos");
    fireEvent.change(screen.getByRole("combobox", { name: "Tienda de la prueba" }), { target: { value: "other-store" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Producto con costo" })).toBeInTheDocument();
    expect(axios.request).not.toHaveBeenCalled();
  });
  it.each(["supervisor", "advertiser"])(
    "allows a %s with edit and hidden profit to create a backend-eligible product test",
    async () => {
      mockProfit = false;
      mockProducts = [
        {
          id: "product",
          name: "Producto apto",
          storeId: "store",
          unitCost: null,
          canTest: true,
          netPrice: null,
          availableStock: "20",
          variants: [{ id: "variant", netPrice: null, unitCost: null }],
        },
      ];
      mockTests = [test];
      (axios.request as jest.Mock).mockResolvedValue({ data: { id: "created-test" } });
      render(
        <AdvertisingStoreFilterProvider
          stores={[{ id: "store", name: "Tienda" }]}
          initialStoreId="store"
        >
          <AdvertisingTests />
        </AdvertisingStoreFilterProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Nueva prueba" }));
      fireEvent.change(screen.getByRole("combobox", { name: "Producto con costo" }), {
        target: { value: "product" },
      });
      fireEvent.change(screen.getByRole("combobox", { name: "Conjunto de anuncios" }), {
        target: { value: "3" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Crear prueba" }));
      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: "https://integrations.test/advertising/companies/company/v22/tests",
          data: expect.objectContaining({
            productId: "product",
            accountId: "account",
            storeId: "store",
            adsetId: "3",
            adIds: ["4"],
          }),
        }),
      );
      expect(screen.queryByText("Máximo")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Pasar a escala" })).not.toBeInTheDocument();
    },
  );
  it("keeps a cost-missing product ineligible for an administrator and accepts a visible zero cost from an older backend", () => {
    mockProducts = [
      {
        id: "missing",
        name: "Sin costo",
        storeId: "store",
        unitCost: null,
        canTest: false,
        netPrice: null,
        availableStock: "20",
        variants: [],
      },
      {
        id: "zero",
        name: "Costo cero",
        storeId: "store",
        unitCost: "0",
        netPrice: null,
        availableStock: "20",
        variants: [],
      },
    ];
    render(
      <AdvertisingStoreFilterProvider
        stores={[{ id: "store", name: "Tienda" }]}
        initialStoreId="store"
      >
        <AdvertisingTests />
      </AdvertisingStoreFilterProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Nueva prueba" }));
    expect(screen.queryByRole("option", { name: /Sin costo/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Costo cero/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear prueba" })).toBeDisabled();
    expect(axios.request).not.toHaveBeenCalled();
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
  it("does not recommend a test decision while only part of the scope's orders have an ad identity", () => {
    const previousTotals = source.sales.totals;
    const previousChannel = source.sales.byChannel;
    try {
      source.sales.totals = { ...metric, orders: 6 };
      source.sales.byChannel = [{ ...metric, orders: 6, storeId: "store", channel: "web" }];
      render(<TestRow test={test} />);
      expect(screen.getByText(/Datos incompletos/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Pasar a escala" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Descartar" })).not.toBeInTheDocument();
      expect(axios.request).not.toHaveBeenCalled();
    } finally {
      source.sales.totals = previousTotals;
      source.sales.byChannel = previousChannel;
    }
  });
});

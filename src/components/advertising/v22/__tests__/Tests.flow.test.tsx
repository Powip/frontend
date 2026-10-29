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
let mockAccountId = "all";
let mockCanManage: boolean | undefined = true;
let mockCatalogRows: AdsRow[];
let mockProductErrorStoreId: string | null = null;
let mockMeasurementsLoading = false;
let mockMeasurementError = false;
let mockTestsLoading = false;
const mockNumbersCalls: unknown[][] = [];
const mockQueries: Array<{
  key: unknown[];
  request: (
    identity: { companyId: string; token: string },
    signal: AbortSignal,
  ) => Promise<unknown>;
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
jest.mock("axios");
jest.mock("../../AdvertisingAccountFilterContext", () => ({
  useAdvertisingAccountFilter: () => ({ accountId: mockAccountId }),
}));
jest.mock("../Numbers", () => ({
  useNumbers: (...args: unknown[]) => {
    mockNumbersCalls.push(args);
    return {
    data: mockMeasurementsLoading || args[5] === false ? undefined : source,
    isError: mockMeasurementError,
    error: new Error("Ventas temporalmente no disponibles"),
  }; },
}));
jest.mock("../context", () => ({
  useAdsV22: () => ({
    identity: { token: "token", companyId: "company" },
    settings: {
      rules: { testMinSales: 3, testMultiplier: 2, winPct: 60 },
      capabilities: { edit: true, spend: true, profit: mockProfit },
    },
  }),
  useRefreshAds: () => refresh,
  useAdsQuery: (
    key: unknown[],
    request: (
      identity: { companyId: string; token: string },
      signal: AbortSignal,
    ) => Promise<unknown>,
    enabled = true,
  ) => {
    mockQueries.push({ key, request, enabled });
    return {
      data: key[0] === "tests" && mockTestsLoading ? undefined : {
        rows: mockCatalogRows,
        products: mockProducts,
        tests: mockTests,
        assignments: source.summary.adProducts,
        capabilities: { canManageAds: mockCanManage },
      },
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
    mockAccountId = "all";
    mockCanManage = true;
    mockCatalogRows = [ad];
    mockProductErrorStoreId = null;
    mockMeasurementsLoading = false;
    mockMeasurementError = false;
    mockTestsLoading = false;
    mockNumbersCalls.length = 0;
    mockQueries.length = 0;
    window.history.replaceState({}, "", "/");
    source.summary.quality = { warnings: [], coverage: "complete" };
    source.summary.days[0].currency = "PEN";
    source.sales.byAd = [{ ...metric, adId: "4", storeId: "store", channel: "web" }];
    process.env.NEXT_PUBLIC_API_INTEGRATIONS = "https://integrations.test";
    Object.defineProperty(global.crypto, "randomUUID", {
      configurable: true,
      value: () => "7d7b6cb1-15cc-44ce-88f3-487066fd5a70",
    });
  });
  it("waits for the tests list before requesting its complete financial period", () => {
    mockTestsLoading = true;
    const ui = render(<AdvertisingTests />);
    expect(mockNumbersCalls.filter((args) => args[3] === "tests-summary")
      .every((args) => args[5] === false)).toBe(true);
    expect(mockQueries.filter((query) => query.key[0] === "ad-products")
      .every((query) => query.enabled === false)).toBe(true);
    mockTestsLoading = false;
    mockTests = [test];
    ui.rerender(<AdvertisingTests />);
    expect(mockNumbersCalls.some((args) => args[3] === "tests-summary" &&
      args[0] === "2026-10-01" && args[5] === true)).toBe(true);
  });
  it("reads assignments instead of sales and daily spend when the selected tests list is empty", async () => {
    render(<AdvertisingTests />);
    expect(mockNumbersCalls.filter((args) => args[3] === "tests-summary")
      .every((args) => args[5] === false)).toBe(true);
    const assignments = mockQueries.find((query) => query.key[0] === "ad-products" && query.enabled);
    expect(assignments).toBeDefined();
    (axios.get as jest.Mock).mockResolvedValue({ data: { assignments: source.summary.adProducts } });
    const signal = new AbortController().signal;
    await assignments!.request({ companyId: "company", token: "token" }, signal);
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/v22/ad-products"),
      expect.objectContaining({ signal }));
    expect(screen.getByText("Gastado en pruebas").parentElement).toHaveTextContent(/S\/\s*0/);
  });
  it("keeps at most three unadvertised product suggestions without requiring a financial read", () => {
    mockMeasurementsLoading = true;
    mockProducts = ["product", "new-1", "new-2", "new-3", "new-4"].map((id) => ({
      id, name: id === "product" ? "Producto ya anunciado" : `Producto ${id}`,
      storeId: "store", canTest: true, unitCost: "10", netPrice: "30", variants: [],
    } as unknown as AdsProduct));
    render(<AdvertisingTests />);
    expect(screen.getAllByRole("button", { name: "Probar" })).toHaveLength(3);
    expect(screen.queryByText("Producto ya anunciado")).not.toBeInTheDocument();
    expect(screen.queryByText("Producto new-4")).not.toBeInTheDocument();
    expect(mockNumbersCalls.every((args) => args[5] === false)).toBe(true);
  });
  it.each(["partial", "foreign"])(
    "keeps the spent-in-tests KPI unknown for %s data even when observed daily spend is numeric",
    (cause) => {
      mockTests = [test];
      if (cause === "partial")
        source.summary.quality = {
          warnings: ["META_DATA_PARTIAL"],
          coverage: "partial",
          spendAvailable: false,
        };
      else source.summary.days[0].currency = "USD";
      render(<AdvertisingTests />);
      const total = screen.getByText("Gastado en pruebas").parentElement!;
      expect(total).toHaveTextContent("—");
      expect(total).not.toHaveTextContent(/S\/\s*60/);
    },
  );
  it("shows measurement progress without inventing zero sales or a verdict", () => {
    mockMeasurementsLoading = true;
    render(<TestRow test={test} />);
    expect(screen.getByText(/Cargando medición…/)).toBeInTheDocument();
    expect(screen.getByLabelText("Cargando medición de la prueba")).toBeInTheDocument();
    expect(screen.queryByText(/Sin costo suficiente/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pasar a escala" })).not.toBeInTheDocument();
  });
  it("does not recommend a verdict from stale measurements after a commercial-data error", () => {
    mockMeasurementError = true;
    render(<TestRow test={test} />);
    expect(screen.getByText(/Medición no disponible/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Ventas temporalmente no disponibles");
    expect(screen.queryByRole("button", { name: "Pasar a escala" })).not.toBeInTheDocument();
  });
  it("only measures the visible test page and scopes catalogs to their set with reusable keys", () => {
    mockTests = Array.from({ length: 12 }, (_, index) => ({ ...test, id: `test-${index}` }));
    render(<AdvertisingTests />);
    expect(screen.getByText("Mostrando 1–10 de 12 pruebas")).toBeInTheDocument();
    const queries = mockQueries.filter((query) => query.key[0] === "test-catalog");
    expect(queries).toHaveLength(10);
    expect(
      queries.every((query) => JSON.stringify(query.key) === JSON.stringify(queries[0].key)),
    ).toBe(true);
    expect(queries[0].key[1]).toEqual(
      expect.objectContaining({ accountId: "account", storeId: "store", adsetId: "3" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Mostrando 11–12 de 12 pruebas")).toBeInTheDocument();
    expect(screen.getAllByText(/Desde 2026-10-01/)).toHaveLength(2);
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
  it.each([false, undefined])(
    "does not offer remote test decisions when Meta management is %s",
    (canManageAds) => {
      mockCanManage = canManageAds;
      render(<TestRow test={test} />);
      expect(screen.queryByRole("button", { name: "Pasar a escala" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Descartar y pausar" })).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("No hay acceso confirmado");
      expect(axios.request).not.toHaveBeenCalled();
    },
  );
  it("does not treat access to another catalog account as access to the test account", () => {
    mockCatalogRows = [ad, { ...ad, id: "other", accountId: "other-account" }];
    render(<TestRow test={test} />);
    expect(screen.queryByRole("button", { name: "Pasar a escala" })).not.toBeInTheDocument();
    expect(axios.request).not.toHaveBeenCalled();
  });
  it("does not submit an open decision after management access becomes unavailable", () => {
    const view = render(<TestRow test={test} />);
    fireEvent.click(screen.getByRole("button", { name: "Pasar a escala" }));
    mockCanManage = false;
    view.rerender(<TestRow test={test} />);
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(axios.request).not.toHaveBeenCalled();
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
  it("scopes test-creation catalogs to the global account and closes stale selections when it changes", async () => {
    mockAccountId = "account";
    mockProducts = [
      {
        id: "product",
        name: "Producto apto",
        storeId: "store",
        unitCost: "10",
        canTest: true,
        variants: [],
      } as unknown as AdsProduct,
    ];
    const content = () => (
      <AdvertisingStoreFilterProvider
        stores={[{ id: "store", name: "Tienda" }]}
        initialStoreId="store"
      >
        <AdvertisingTests />
      </AdvertisingStoreFilterProvider>
    );
    const view = render(content());
    fireEvent.click(screen.getByRole("button", { name: "Nueva prueba" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Producto con costo" }), {
      target: { value: "product" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Conjunto de anuncios" }), {
      target: { value: "3" },
    });
    const request = mockQueries
      .filter((query) => query.key[0] === "tests-catalog" && query.enabled)
      .at(-1)!;
    expect(request.key).toEqual(["tests-catalog", "store", "account"]);
    (axios.get as jest.Mock).mockResolvedValue({
      data: {
        rows: [ad],
        accounts: [],
        capabilities: { canManageAds: false },
        pagination: { page: 1, pageSize: 100, total: 1, hasMore: false },
      },
    });
    await request.request({ companyId: "company", token: "token" }, new AbortController().signal);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/meta/v22/catalog"),
      expect.objectContaining({
        params: expect.objectContaining({ accountId: "account", storeId: "store" }),
      }),
    );
    mockAccountId = "other-account";
    view.rerender(content());
    expect(screen.queryByRole("combobox", { name: "Producto con costo" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nueva prueba" }));
    expect(screen.getByRole("combobox", { name: "Producto con costo" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Conjunto de anuncios" })).toHaveValue("");
    expect(axios.request).not.toHaveBeenCalled();
  });
  it("rejects stale or mixed-account test ads before posting a create request", async () => {
    mockAccountId = "account";
    mockProducts = [
      {
        id: "product",
        name: "Producto apto",
        storeId: "store",
        unitCost: "10",
        canTest: true,
        variants: [],
      } as unknown as AdsProduct,
    ];
    mockCatalogRows = [ad, { ...ad, id: "foreign", accountId: "other-account" }];
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
    expect((await screen.findAllByRole("alert"))[0]).toHaveTextContent(
      "no pertenecen a la cuenta seleccionada",
    );
    expect(axios.request).not.toHaveBeenCalled();
  });
  it("requires at least one commercial store before opening test creation", () => {
    render(<AdvertisingTests />);
    expect(screen.getByRole("button", { name: "Nueva prueba" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Configura una tienda comercial");
  });
  it("keeps the business list unfiltered and requires an explicit local store to create a test", async () => {
    mockProducts = [
      {
        id: "product",
        name: "Producto compartido",
        storeId: "warehouse",
        canTest: true,
        unitCost: "10",
        variants: [],
      } as unknown as AdsProduct,
    ];
    (axios.request as jest.Mock).mockResolvedValue({ data: { id: "created-test" } });
    (axios.get as jest.Mock).mockResolvedValue({ data: { products: mockProducts } });
    render(
      <AdvertisingStoreFilterProvider
        stores={[
          { id: "store", name: "Tienda comercial" },
          { id: "other-store", name: "Otra tienda" },
        ]}
        initialStoreId="all"
      >
        <AdvertisingTests />
      </AdvertisingStoreFilterProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Nueva prueba" }));
    expect(screen.getByRole("combobox", { name: "Tienda de la prueba" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Producto con costo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Crear prueba" })).toBeDisabled();
    expect(
      mockQueries
        .filter((query) => query.key[0] === "test-create-products")
        .every((query) => !query.enabled),
    ).toBe(true);
    fireEvent.change(screen.getByRole("combobox", { name: "Tienda de la prueba" }), {
      target: { value: "store" },
    });
    expect(window.location.search).toBe("");
    const productQuery = mockQueries
      .filter((query) => query.key[0] === "test-create-products" && query.enabled)
      .at(-1)!;
    await productQuery.request(
      { companyId: "company", token: "token" },
      new AbortController().signal,
    );
    expect(axios.get).toHaveBeenCalledWith(
      "https://integrations.test/advertising/companies/company/v22/products",
      expect.objectContaining({ params: { storeId: "store" } }),
    );
    expect(
      mockQueries
        .filter((query) => query.key[0] === "tests")
        .every((query) => query.key[1] === "all"),
    ).toBe(true);
    expect(
      mockQueries
        .filter((query) => query.key[0] === "tests-catalog" && query.enabled)
        .every((query) => query.key[1] === "store"),
    ).toBe(true);
    fireEvent.change(screen.getByRole("combobox", { name: "Producto con costo" }), {
      target: { value: "product" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Conjunto de anuncios" }), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear prueba" }));
    await waitFor(() =>
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          data: expect.objectContaining({
            storeId: "store",
            productId: "product",
            accountId: "account",
            adIds: ["4"],
          }),
        }),
      ),
    );
  });
  it("clears a local test selection on store changes without changing the business filter", () => {
    mockProducts = [
      {
        id: "product",
        name: "Producto",
        storeId: "warehouse",
        canTest: true,
        variants: [],
      } as unknown as AdsProduct,
    ];
    render(
      <AdvertisingStoreFilterProvider
        stores={[
          { id: "store", name: "Primera" },
          { id: "other-store", name: "Segunda" },
        ]}
        initialStoreId="all"
      >
        <AdvertisingTests />
      </AdvertisingStoreFilterProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Nueva prueba" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Tienda de la prueba" }), {
      target: { value: "store" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Producto con costo" }), {
      target: { value: "product" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Conjunto de anuncios" }), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Tienda de la prueba" }), {
      target: { value: "other-store" },
    });
    expect(screen.getByRole("combobox", { name: "Producto con costo" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Conjunto de anuncios" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Crear prueba" })).toBeDisabled();
    expect(axios.request).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });
  it("keeps the local store choice available after a product query fails", () => {
    mockProductErrorStoreId = "store";
    render(
      <AdvertisingStoreFilterProvider
        stores={[
          { id: "store", name: "Primera" },
          { id: "other-store", name: "Segunda" },
        ]}
        initialStoreId="all"
      >
        <AdvertisingTests />
      </AdvertisingStoreFilterProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Nueva prueba" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Tienda de la prueba" }), {
      target: { value: "store" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron consultar los productos");
    fireEvent.change(screen.getByRole("combobox", { name: "Tienda de la prueba" }), {
      target: { value: "other-store" },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Producto con costo" })).toBeInTheDocument();
    expect(axios.request).not.toHaveBeenCalled();
  });
  it.each(["supervisor", "advertiser"])(
    "allows a %s with edit and hidden profit to create a backend-eligible product test",
    async () => {
      mockProfit = false;
      mockCanManage = false;
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

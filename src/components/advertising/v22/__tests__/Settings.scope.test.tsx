import { fireEvent, render, screen } from "@testing-library/react";
import { AdvertisingSettings } from "../Settings";
import { adsGet, getAdsSales, getAllAdsCatalog } from "@/services/advertisingV22Service";
import type { AdsIdentity, AdsProduct, AdsRow, AdsSettings } from "@/services/advertisingV22Service";

const mockIdentity = { token: "test-token", companyId: "company" } as AdsIdentity;
const mockRefresh = jest.fn();
const mockRefetch = jest.fn();
const mockSettings = {
  version: 1, rules: {}, tags: { hooks: [], creators: [] },
  capabilities: { view: true, spend: true, profit: true, edit: true, configure: true },
  permissions: [], budgets: [], whatsapp: { enabled: false, time: "08:00", numbers: [], includes: [] },
} as unknown as AdsSettings;
let mockPeriod = { fromDate: "2026-10-17", toDate: "2026-10-23" };
let mockStoreId = "all";
let mockProductState: "ready" | "pending" | "error" = "ready";
let mockCatalogState: "ready" | "pending" = "ready";
let mockAssignmentState: "ready" | "pending" = "ready";
let mockCatalogRows: AdsRow[];
let mockProducts: AdsProduct[];
const mockRequests: Array<{
  key: unknown[];
  request: (identity: AdsIdentity, signal: AbortSignal) => Promise<unknown>;
  enabled: boolean;
}> = [];
jest.mock("@/services/advertisingV22Service", () => ({
  ...jest.requireActual("@/services/advertisingV22Service"),
  adsGet: jest.fn().mockResolvedValue({ products: [] }),
  adsWrite: jest.fn(),
  getAllAdsCatalog: jest.fn().mockResolvedValue({ rows: [] }),
  getAdsSales: jest.fn().mockResolvedValue({}),
}));
jest.mock("@/contexts/AdminPeriodContext", () => ({ useAdminPeriod: () => mockPeriod }));
jest.mock("../../AdvertisingStoreFilterContext", () => ({
  useAdvertisingStoreFilter: () => ({ storeId: mockStoreId, stores: [
    { id: "store-a", name: "Tienda A" }, { id: "store-b", name: "Tienda B" },
  ] }),
}));
jest.mock("../context", () => ({
  useAdsV22: () => ({ identity: mockIdentity, actorId: "actor", settings: mockSettings, reload: mockRefresh }),
  useRefreshAds: () => mockRefresh,
  useAdsQuery: (key: unknown[], request: (identity: AdsIdentity, signal: AbortSignal) => Promise<unknown>, enabled = true) => {
    mockRequests.push({ key, request, enabled });
    let data: unknown;
    let error: Error | undefined;
    if (key[0] === "config-ads" && mockCatalogState === "ready") data = { rows: mockCatalogRows, accounts: [] };
    if (key[0] === "products-v22") {
      if (mockProductState === "ready") data = { products: mockProducts };
      if (mockProductState === "error") error = new Error("No se pudieron cargar los productos");
    }
    if (key[0] === "ad-products" && mockAssignmentState === "ready") data = { assignments: [] };
    if (key[0] === "profit-connections") data = { source: "selected-sales" };
    return { data, error, isError: !!error, isPending: !data && !error, refetch: mockRefetch };
  },
}));
jest.mock("../../AdvertisingLivePanel", () => ({ AdvertisingLivePanel: () => null }));
jest.mock("../../AdvertisingStoreAssignmentsPanel", () => ({ AdvertisingStoreAssignmentsPanel: () => null }));
jest.mock("../ProfitConnections", () => ({ ProfitConnections: ({ from, to }: { from: string; to: string }) => <p>Ventas {from} a {to}</p> }));

const latest = (name: string) => [...mockRequests].reverse().find((entry) => entry.key[0] === name)!;
const selectors = () => screen.queryAllByRole("combobox", { name: /^Producto de / });
function mount() { return render(<AdvertisingSettings />); }

beforeEach(() => {
  jest.clearAllMocks();
  mockRequests.length = 0;
  mockPeriod = { fromDate: "2026-10-17", toDate: "2026-10-23" };
  mockStoreId = "all";
  mockProductState = "ready";
  mockCatalogState = "ready";
  mockAssignmentState = "ready";
  mockCatalogRows = Array.from({ length: 200 }, (_, index) => ({
    id: String(1000 + index), accountId: "account", adsetId: "adset", level: "ad",
    name: `Anuncio ${String(index).padStart(3, "0")}`, store: { id: index < 100 ? "store-a" : "store-b", name: "Tienda" },
    destinationType: "WHATSAPP", destinations: [], insights: { spend: "1" },
  }) as AdsRow);
  mockProducts = Array.from({ length: 8 }, (_, index) => ({ id: `product-${index}`, name: `Producto ${index}` }) as AdsProduct);
  global.structuredClone ??= <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  window.history.replaceState({}, "", "/publicidad/configuracion?section=products");
});

it("uses the selected period and store in catalog keys and all related request parameters", async () => {
  mockStoreId = "store-a";
  mount();
  const signal = new AbortController().signal;
  expect(latest("config-ads")).toMatchObject({ key: ["config-ads", "2026-10-17", "2026-10-23", "store-a"], enabled: true });
  await latest("config-ads").request(mockIdentity, signal);
  expect(getAllAdsCatalog).toHaveBeenLastCalledWith(mockIdentity, { from: "2026-10-17", to: "2026-10-23", level: "ad", storeId: "store-a" }, signal);
  expect(latest("products-v22").key).toEqual(["products-v22", "store-a"]);
  await latest("products-v22").request(mockIdentity, signal);
  expect(adsGet).toHaveBeenLastCalledWith(mockIdentity, "/v22/products", { storeId: "store-a" }, signal);
  fireEvent.click(screen.getByRole("button", { name: "Ventas y costos de POWIP" }));
  expect(latest("profit-connections")).toMatchObject({ key: ["profit-connections", "2026-10-17", "2026-10-23", "store-a"], enabled: true });
  await latest("profit-connections").request(mockIdentity, signal);
  expect(getAdsSales).toHaveBeenLastCalledWith(mockIdentity, "2026-10-17", "2026-10-23", "store-a", signal);
});

it("renders only ten selectors for 200 ads and 384 business products, with working pagination and search", () => {
  mockProducts = Array.from({ length: 384 }, (_, index) => ({ id: `product-${index}`, name: `Producto ${index}` }) as AdsProduct);
  mount();
  expect(screen.getByText("Mostrando 1–10 de 200 anuncios")).toBeInTheDocument();
  expect(selectors()).toHaveLength(10);
  expect(document.querySelectorAll("option")).toHaveLength(10 * 386);
  expect(selectors()[0].querySelectorAll("option")).toHaveLength(386);
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(screen.getByText("Mostrando 11–20 de 200 anuncios")).toBeInTheDocument();
  expect(selectors()).toHaveLength(10);
  expect(screen.getByRole("combobox", { name: "Producto de Anuncio 010" })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Buscar anuncio para vincular producto" }), { target: { value: "Anuncio 199" } });
  expect(screen.getByText("Mostrando 1–1 de 1 anuncios")).toBeInTheDocument();
  expect(selectors()).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox", { name: "Buscar anuncio para vincular producto" }), { target: { value: "1005" } });
  expect(screen.getByRole("combobox", { name: "Producto de Anuncio 005" })).toBeInTheDocument();
});

it.each(["products", "catalog", "assignments"])("does not render misleading two-option menus while %s are pending", (source) => {
  if (source === "products") mockProductState = "pending";
  if (source === "catalog") mockCatalogState = "pending";
  if (source === "assignments") mockAssignmentState = "pending";
  mount();
  expect(screen.getByRole("status")).toHaveTextContent("Cargando anuncios y productos");
  expect(selectors()).toHaveLength(0);
  expect(screen.queryByRole("option", { name: "Sin producto" })).not.toBeInTheDocument();
});

it("shows product errors and a retry instead of pretending the catalog has no products", () => {
  mockProductState = "error";
  mount();
  expect(screen.getByText("No se pudieron cargar los productos")).toBeInTheDocument();
  expect(selectors()).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Volver a intentar" }));
  expect(mockRefetch).toHaveBeenCalledTimes(3);
});

it("resets pagination and search whenever period or commercial scope changes", () => {
  const view = mount();
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(screen.getByText("Mostrando 11–20 de 200 anuncios")).toBeInTheDocument();
  mockPeriod = { fromDate: "2026-10-01", toDate: "2026-10-23" };
  view.rerender(<AdvertisingSettings />);
  expect(screen.getByText("Mostrando 1–10 de 200 anuncios")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Buscar anuncio para vincular producto" }), { target: { value: "Anuncio 199" } });
  expect(selectors()).toHaveLength(1);
  mockStoreId = "store-a";
  view.rerender(<AdvertisingSettings />);
  expect(screen.getByRole("textbox", { name: "Buscar anuncio para vincular producto" })).toHaveValue("");
  expect(screen.getByText("Mostrando 1–10 de 100 anuncios")).toBeInTheDocument();
  expect(selectors()).toHaveLength(10);
});

it("disables catalog requests for a future period and shows guidance without loading or selectors", () => {
  mockPeriod = { fromDate: "2100-01-01", toDate: "2100-01-31" };
  mount();
  expect(latest("config-ads").enabled).toBe(false);
  expect(screen.getByText("Elige un período que ya haya comenzado para revisar anuncios.")).toBeInTheDocument();
  expect(screen.queryByText("Cargando anuncios y productos…")).not.toBeInTheDocument();
  expect(selectors()).toHaveLength(0);
  expect(getAllAdsCatalog).not.toHaveBeenCalled();
});

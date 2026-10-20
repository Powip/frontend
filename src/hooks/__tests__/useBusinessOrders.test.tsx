import React, { type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBusinessOrders } from "../useBusinessOrders";
import axiosAuth from "@/lib/axiosAuth";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
let mockCompany = "business";
let mockUser = "owner";
let mockStoreIds = ["empty", "web"];
let mockCanFetch = true;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "session-token", company: { id: mockCompany }, user: { id: mockUser } } }) }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ storeIds: mockStoreIds, canFetch: mockCanFetch }) }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

beforeEach(() => {
  jest.clearAllMocks(); mockCompany = "business"; mockUser = "owner"; mockStoreIds = ["empty", "web"]; mockCanFetch = true;
});

it("shows WEB orders with their actual origin while the selected store is empty, authenticating every store", async () => {
  const order = { id: "web-order", storeId: "web", inventoryId: "web-warehouse", stockStoreId: "web" };
  jest.mocked(axiosAuth.get).mockImplementation(async (url) => ({ data: String(url).endsWith("/web") ? [order] : [] }));
  const { wrapper } = setup();
  const { result } = renderHook(() => useBusinessOrders(), { wrapper });
  await waitFor(() => expect(result.current.orders).toEqual([order]));
  expect(axiosAuth.get).toHaveBeenCalledTimes(2);
  for (const [, config] of jest.mocked(axiosAuth.get).mock.calls) {
    expect(config?.headers).toEqual({ Authorization: "Bearer session-token" });
    expect(config?.params).not.toHaveProperty("includeCcLeads");
    expect(config?.signal).toBeDefined();
  }
});

it("reports failure instead of presenting a partial business total when one store fails", async () => {
  jest.mocked(axiosAuth.get).mockImplementation(async (url) => {
    if (String(url).endsWith("/web")) throw new Error("401");
    return { data: [{ id: "partial-order" }] };
  });
  const { wrapper } = setup();
  const { result } = renderHook(() => useBusinessOrders(), { wrapper });
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.orders).toEqual([]);
});

it("clears previous business data when changing identity and never requests without an authorized scope", async () => {
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: [{ id: "previous-order" }] });
  const { wrapper } = setup();
  const { result, rerender } = renderHook(() => useBusinessOrders(), { wrapper });
  await waitFor(() => expect(result.current.orders).toHaveLength(1));
  mockCompany = "new-business"; mockUser = "new-owner"; mockStoreIds = []; mockCanFetch = false;
  rerender();
  expect(result.current.orders).toEqual([]);
  expect(result.current.loading).toBe(false);
  expect(axiosAuth.get).toHaveBeenCalledTimes(2);
});

it("keeps the full CC lead contract separate from operational queues", async () => {
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: [] });
  const { wrapper } = setup();
  const { result } = renderHook(() => useBusinessOrders(undefined, undefined, { includeCcLeads: true }), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(jest.mocked(axiosAuth.get).mock.calls.every(([, config]) => config?.params.includeCcLeads === true)).toBe(true);
});


it("preserves backend commercial admission of Shopify paid and CC-confirmed pending sales while keeping lead reads separate", async () => {
  mockStoreIds = ["web"];
  const paidShopify = { id: "paid-shopify", externalSource: "SHOPIFY", status: "PENDIENTE", subEstadoCc: null, unitAssignmentStatus: "PENDING_SELECTION", unitCatalogValidated: true, unitStockState: "reserved", stockVersion: 1, confirmedStockVersion: 1 };
  const confirmedCod = { ...paidShopify, id: "cod-confirmed", subEstadoCc: "confirmado", ccConfirmadoAt: "2026-10-18T10:00:00Z" };
  const none = { id: "none", status: "PENDIENTE", unitAssignmentStatus: "NONE" };
  const lead = { ...paidShopify, id: "cod-lead", subEstadoCc: "por_confirmar", unitStockState: null, confirmedStockVersion: null };
  jest.mocked(axiosAuth.get).mockImplementation(async (_url, config) => ({ data: config?.params.includeCcLeads ? [paidShopify, confirmedCod, none, lead] : [paidShopify, confirmedCod, none] }));
  const { wrapper } = setup();
  const commercial = renderHook(() => useBusinessOrders(), { wrapper });
  const cc = renderHook(() => useBusinessOrders(undefined, undefined, { includeCcLeads: true }), { wrapper });
  await waitFor(() => expect(commercial.result.current.orders.map(order => order.id)).toEqual(["paid-shopify", "cod-confirmed", "none"]));
  await waitFor(() => expect(cc.result.current.orders).toHaveLength(4));
  expect(commercial.result.current.orders[1]).toMatchObject({ status: "PENDIENTE", subEstadoCc: "confirmado", unitStockState: "reserved", confirmedStockVersion: 1 });
  expect(axiosAuth.get).toHaveBeenCalledTimes(2);
});

it("sends the statuses filter as a comma-separated status param", async () => {
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: [] });
  const { wrapper } = setup();
  const { result } = renderHook(() => useBusinessOrders(undefined, undefined, { statuses: ["PENDIENTE", "PAGADO"] }), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  for (const [, config] of jest.mocked(axiosAuth.get).mock.calls) {
    expect(config?.params).toEqual({ fromDate: undefined, toDate: undefined, status: "PENDIENTE,PAGADO" });
  }
});

it("does not send status when no statuses are given", async () => {
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: [] });
  const { wrapper } = setup();
  const { result } = renderHook(() => useBusinessOrders(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  for (const [, config] of jest.mocked(axiosAuth.get).mock.calls) {
    expect(config?.params).not.toHaveProperty("status");
  }
});

import React, { type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { BusinessScopeProvider, useBusinessScope } from "@/contexts/BusinessScopeContext";
import { getDashboardOrders } from "@/services/dashboardService";
import { useBusinessOrders } from "../useBusinessOrders";
import type { OrderHeader } from "@/interfaces/IOrder";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/dashboardService", () => ({ getDashboardOrders: jest.fn() }));

const mockUseAuth = jest.mocked(useAuth);
const mockGetOrders = jest.mocked(getDashboardOrders);
let authState: ReturnType<typeof useAuth>;

const webOrder = {
  id: "web-order",
  storeId: "store-web",
  inventoryId: "shared-warehouse",
  stockStoreId: "store-empty",
} as OrderHeader;

function session(role: string, companyId = "company-a", userId = "operative-a") {
  return {
    auth: {
      accessToken: `${companyId}-token`,
      user: { id: userId, role, email: "operative@example.test" },
      company: {
        id: companyId,
        stores: [
          { id: "store-empty", name: "Tienda sin pedidos" },
          { id: "store-web", name: "WEB" },
          { id: "store-web", name: "WEB" },
        ],
      },
    },
    selectedStoreId: "store-empty",
    loading: false,
  } as ReturnType<typeof useAuth>;
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <BusinessScopeProvider>{children}</BusinessScopeProvider>
      </QueryClientProvider>
    );
  }
  return Wrapper;
}

function useScopedOrders() {
  const query = useBusinessOrders();
  const { setScope } = useBusinessScope();
  return { ...query, setScope };
}

beforeEach(() => {
  jest.clearAllMocks();
  authState = session("VENTAS");
  mockUseAuth.mockImplementation(() => authState);
  mockGetOrders.mockImplementation(async (storeIds) => storeIds.includes("store-web") ? [webOrder] : []);
});

it.each(["VENTAS", "ALMACEN"])("loads every current-company store when the %s session is restored", async (role) => {
  authState = { ...session(role), auth: null, selectedStoreId: null, loading: true };
  const { result, rerender } = renderHook(useScopedOrders, { wrapper: setup() });
  expect(mockGetOrders).not.toHaveBeenCalled();
  expect(result.current.orders).toEqual([]);

  authState = session(role);
  rerender();

  await waitFor(() => expect(result.current.orders).toEqual([
    expect.objectContaining({ ...webOrder, storeName: "WEB", stockStoreName: "Tienda sin pedidos" }),
  ]));
  expect(mockGetOrders).toHaveBeenCalledTimes(1);
  expect(mockGetOrders).toHaveBeenCalledWith(
    ["store-empty", "store-web"], undefined, undefined, "company-a-token",
    expect.objectContaining({ signal: expect.any(AbortSignal), includeCcLeads: false }),
  );
});

it.each(["VENTAS", "ALMACEN"])("keeps the selected destination while %s switches between business and store reads", async (role) => {
  authState = session(role);
  const { result, rerender } = renderHook(useScopedOrders, { wrapper: setup() });
  await waitFor(() => expect(result.current.orders[0]?.id).toBe("web-order"));

  act(() => result.current.setScope("store"));
  expect(result.current.orders).toEqual([]);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(mockGetOrders).toHaveBeenLastCalledWith(
    ["store-empty"], undefined, undefined, "company-a-token", expect.any(Object),
  );
  expect(authState.selectedStoreId).toBe("store-empty");

  authState = { ...authState, selectedStoreId: "store-web" };
  rerender();
  await waitFor(() => expect(result.current.orders[0]?.id).toBe("web-order"));
  expect(mockGetOrders).toHaveBeenLastCalledWith(
    ["store-web"], undefined, undefined, "company-a-token", expect.any(Object),
  );

  act(() => result.current.setScope("business"));
  await waitFor(() => expect(result.current.orders[0]?.storeId).toBe("store-web"));
  expect(authState.selectedStoreId).toBe("store-web");
});

it.each(["company", "user"])("clears old orders while a new %s identity loads, resetting an explicit store choice", async (identity) => {
  const { result, rerender } = renderHook(useScopedOrders, { wrapper: setup() });
  await waitFor(() => expect(result.current.orders[0]?.id).toBe("web-order"));
  authState = { ...authState, selectedStoreId: "store-web" };
  rerender();
  act(() => result.current.setScope("store"));
  await waitFor(() => expect(mockGetOrders).toHaveBeenLastCalledWith(
    ["store-web"], undefined, undefined, "company-a-token", expect.any(Object),
  ));

  let finishNewRequest!: (orders: OrderHeader[]) => void;
  mockGetOrders.mockImplementation(() => new Promise((resolve) => { finishNewRequest = resolve; }));
  authState = {
    ...authState,
    auth: {
      ...authState.auth!,
      accessToken: "new-session-token",
      user: { ...authState.auth!.user, id: identity === "user" ? "operative-b" : "operative-a" },
      company: {
        ...authState.auth!.company!,
        id: identity === "company" ? "company-b" : "company-a",
        stores: [{ id: "new-empty", name: "Nueva vacía" }, { id: "new-web", name: "Nueva WEB" }],
      },
    },
    selectedStoreId: "new-empty",
  };
  rerender();

  expect(result.current.orders).toEqual([]);
  await waitFor(() => expect(mockGetOrders).toHaveBeenLastCalledWith(
    ["new-empty", "new-web"], undefined, undefined, "new-session-token", expect.any(Object),
  ));
  expect(result.current.orders).toEqual([]);
  const newOrder = { ...webOrder, id: "new-order", storeId: "new-web", stockStoreId: "new-empty" };
  await act(async () => { finishNewRequest([newOrder]); });
  await waitFor(() => expect(result.current.orders).toEqual([
    expect.objectContaining({ ...newOrder, storeName: "Nueva WEB", stockStoreName: "Nueva vacía" }),
  ]));
});

import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useReconciliationVariantSearch } from "../useReconciliationVariantSearch";
import { useReconciliationStockByVariants } from "../useReconciliationStockByVariants";
import { useReconciliationTaskDetails } from "../useReconciliationTaskDetails";
import { searchReconciliationVariants, getReconciliationTaskDetails } from "@/services/reconciliationTask.service";
import { getStockByVariants } from "@/services/inventoryItems.service";
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/reconciliationTask.service", () => ({ searchReconciliationVariants: jest.fn(), getReconciliationTaskDetails: jest.fn() }));
jest.mock("@/services/inventoryItems.service", () => ({ getStockByVariants: jest.fn() }));
const mockAuth = jest.mocked(useAuth);
const search = jest.mocked(searchReconciliationVariants);
const details = jest.mocked(getReconciliationTaskDetails);
const stock = jest.mocked(getStockByVariants);
const auth = (id: string) => ({ auth: { company: { id }, user: { id: "user-a" }, accessToken: "test-token" } }) as ReturnType<typeof useAuth>;
function setup() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return function Wrapper({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }; }
beforeEach(() => { jest.clearAllMocks(); search.mockResolvedValue([]); details.mockResolvedValue({} as Awaited<ReturnType<typeof getReconciliationTaskDetails>>); stock.mockResolvedValue([]); });
it("refetches search, task detail and stock when the company changes despite matching text and IDs", async () => {
  mockAuth.mockReturnValue(auth("company-a"));
  const { result, rerender } = renderHook(() => ({ search: useReconciliationVariantSearch("camisa"), details: useReconciliationTaskDetails("task-a"), stock: useReconciliationStockByVariants(["variant-a"]) }), { wrapper: setup() });
  await waitFor(() => expect(result.current.details.isSuccess && result.current.stock.isSuccess).toBe(true));
  await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
  mockAuth.mockReturnValue(auth("company-b")); rerender();
  await waitFor(() => { expect(search).toHaveBeenCalledTimes(2); expect(details).toHaveBeenCalledTimes(2); expect(stock).toHaveBeenCalledTimes(2); });
});
it("does not query company reconciliation without an authenticated session", () => {
  mockAuth.mockReturnValue({ auth: null } as ReturnType<typeof useAuth>);
  renderHook(() => ({ search: useReconciliationVariantSearch("camisa"), details: useReconciliationTaskDetails("task-a"), stock: useReconciliationStockByVariants(["variant-a"]) }), { wrapper: setup() });
  expect(search).not.toHaveBeenCalled(); expect(details).not.toHaveBeenCalled(); expect(stock).not.toHaveBeenCalled();
});

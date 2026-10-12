import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBusinessInventories } from "../useBusinessInventories";
import { useAuth } from "@/contexts/AuthContext";
import { fetchScopeInventories } from "@/services/inventoryCatalogService";
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/inventoryCatalogService", () => ({ fetchScopeInventories: jest.fn() }));
const mockAuth = jest.mocked(useAuth);
const fetch = jest.mocked(fetchScopeInventories);
const auth = (companyId: string, userId = "user-a") => ({ auth: { accessToken: "test-token", company: { id: companyId }, user: { id: userId } } }) as ReturnType<typeof useAuth>;
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  return Wrapper;
}
beforeEach(() => { mockAuth.mockReset(); fetch.mockReset(); });
it("isolates the catalog between companies and users even while the query cache survives", async () => {
  mockAuth.mockReturnValue(auth("company-a"));
  fetch.mockImplementation(async (request) => [{ id: `${request.companyId}-warehouse`, name: "Principal", storeId: "owner" }]);
  const { result, rerender } = renderHook(() => useBusinessInventories(), { wrapper: setup() });
  await waitFor(() => expect(result.current.inventories[0]?.id).toBe("company-a-warehouse"));
  mockAuth.mockReturnValue(auth("company-b")); rerender();
  expect(result.current.inventories).toHaveLength(0);
  await waitFor(() => expect(result.current.inventories[0]?.id).toBe("company-b-warehouse"));
  mockAuth.mockReturnValue(auth("company-b", "user-b")); rerender();
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
});
it("keeps the empty array stable and finishes loading when auth is unavailable", () => {
  mockAuth.mockReturnValue({ auth: null } as ReturnType<typeof useAuth>);
  const { result, rerender } = renderHook(() => useBusinessInventories(), { wrapper: setup() });
  const empty = result.current.inventories; rerender();
  expect(result.current.inventories).toBe(empty);
  expect(result.current.loading).toBe(false);
  expect(result.current.isPending).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
});
it("deduplicates the store query and exposes failures for a visible retry", async () => {
  mockAuth.mockReturnValue(auth("company-a")); fetch.mockRejectedValue(new Error("401 Unauthorized"));
  const { result } = renderHook(() => useBusinessInventories({ scope: "store", storeIds: ["store-a", "store-a"] }), { wrapper: setup() });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error?.message).toContain("401");
  expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ companyId: "company-a", accessToken: "test-token", scope: "store", storeIds: ["store-a"] }));
});

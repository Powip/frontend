import React, { type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBusinessOrdersCount } from "../useBusinessOrdersCount";
import axiosAuth from "@/lib/axiosAuth";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "session-token", company: { id: "business" }, user: { id: "owner" } } }) }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ storeIds: ["a", "b"], canFetch: true }) }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { wrapper };
}

beforeEach(() => jest.clearAllMocks());

it("sums the count of every store using the /count endpoint and the status filter", async () => {
  jest.mocked(axiosAuth.get).mockImplementation(async (url) => ({ data: { count: String(url).endsWith("/a/count") ? 3 : 4 } }));
  const { wrapper } = setup();
  const { result } = renderHook(() => useBusinessOrdersCount("2026-09-21", "2026-10-20", { statuses: ["PENDIENTE", "PAGADO"] }), { wrapper });
  await waitFor(() => expect(result.current.count).toBe(7));
  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBe(false);
  const calls = jest.mocked(axiosAuth.get).mock.calls;
  expect(calls).toHaveLength(2);
  for (const [url, config] of calls) {
    expect(String(url)).toMatch(/\/order-header\/store\/[ab]\/count$/);
    expect(config?.params).toMatchObject({ fromDate: "2026-09-21", toDate: "2026-10-20", status: "PENDIENTE,PAGADO" });
  }
});

it("reports error with a null count when one store fails", async () => {
  jest.mocked(axiosAuth.get).mockImplementation(async (url) => {
    if (String(url).includes("/b/")) throw new Error("500");
    return { data: { count: 3 } };
  });
  const { wrapper } = setup();
  const { result } = renderHook(() => useBusinessOrdersCount("2026-09-21", "2026-10-20", {}), { wrapper });
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.loading).toBe(false);
  expect(result.current.count).toBeNull();
});

it("is loading with a null count and no error while the request is pending", async () => {
  jest.mocked(axiosAuth.get).mockReturnValue(new Promise(() => {}));
  const { wrapper } = setup();
  const { result } = renderHook(() => useBusinessOrdersCount("2026-09-21", "2026-10-20", {}), { wrapper });
  expect(result.current.loading).toBe(true);
  expect(result.current.error).toBe(false);
  expect(result.current.count).toBeNull();
});

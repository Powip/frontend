import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import axiosAuth from "@/lib/axiosAuth";
import type { BusinessSalesPage, BusinessSalesQuery } from "@/services/businessSalesService";
import { useBusinessSalesPage } from "../useBusinessSalesPage";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));

const initialQuery: BusinessSalesQuery = { tab: "pendientes", page: 1, limit: 10, search: "" };
const session = (userId = "user-1", companyId = "company-1") => ({
  auth: { user: { id: userId }, company: { id: companyId } },
}) as ReturnType<typeof useAuth>;
const pageResult: BusinessSalesPage = {
  data: [], total: 450, page: 1, totalPages: 45,
  counts: { pendientes: 450, anuladas: 5, todas: 600 },
  kpis: { pendientes: 450, anuladas: 5, amounts: [] },
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(useAuth).mockReturnValue(session());
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: pageResult });
});

it("opens business sales with one bounded request and keys page/filter results by company and actor", async () => {
  const { client, wrapper } = setup();
  const { result, rerender, unmount } = renderHook(
    ({ query, storeIds }: { query: BusinessSalesQuery; storeIds: string[] }) => useBusinessSalesPage(storeIds, query),
    { wrapper, initialProps: { query: initialQuery, storeIds: ["store-b", "store-a", "store-b"] } },
  );
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(axiosAuth.get).toHaveBeenCalledTimes(1);
  const [initialUrl, initialConfig] = jest.mocked(axiosAuth.get).mock.calls[0];
  expect(initialUrl).toContain("/order-header/business/list?");
  const params = new URL(String(initialUrl), "http://localhost").searchParams;
  expect(params.get("storeIds")).toBe("store-a,store-b");
  expect(params.get("page")).toBe("1");
  expect(params.get("limit")).toBe("10");
  expect(initialConfig?.signal).toBeInstanceOf(AbortSignal);
  expect(result.current.data?.total).toBe(450);

  rerender({ query: initialQuery, storeIds: ["store-a", "store-b"] });
  expect(axiosAuth.get).toHaveBeenCalledTimes(1);
  rerender({ query: { ...initialQuery, page: 2 }, storeIds: ["store-a", "store-b"] });
  expect(result.current.data).toBeUndefined();
  await waitFor(() => expect(axiosAuth.get).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(jest.mocked(axiosAuth.get).mock.calls[1][0]).toContain("page=2");

  rerender({ query: { ...initialQuery, region: "LIMA" }, storeIds: ["store-a", "store-b"] });
  await waitFor(() => expect(axiosAuth.get).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(jest.mocked(axiosAuth.get).mock.calls[2][0]).toContain("region=LIMA");
  for (const query of client.getQueryCache().getAll()) {
    expect(query.queryKey).toEqual(expect.arrayContaining(["company-1", "user-1"]));
  }

  jest.mocked(useAuth).mockReturnValue(session("user-2", "company-2"));
  rerender({ query: initialQuery, storeIds: ["store-new"] });
  expect(result.current.data).toBeUndefined();
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(jest.mocked(axiosAuth.get).mock.calls[3][0]).toContain("storeIds=store-new");
  expect(client.getQueryCache().getAll().at(-1)?.queryKey).toEqual(
    expect.arrayContaining(["company-2", "user-2"]),
  );
  unmount();
  client.clear();
});

it("waits 350 ms after the last search keystroke before issuing one request", async () => {
  jest.useFakeTimers();
  const { client, wrapper } = setup();
  const { result, rerender, unmount } = renderHook(
    ({ search }) => useBusinessSalesPage(["store-a", "store-b"], { ...initialQuery, search }),
    { wrapper, initialProps: { search: "" } },
  );
  try {
    await act(async () => {});
    expect(axiosAuth.get).toHaveBeenCalledTimes(1);
    rerender({ search: "a" });
    expect(result.current.isDebouncing).toBe(true);
    await act(async () => { jest.advanceTimersByTime(200); });
    rerender({ search: "an" });
    await act(async () => { jest.advanceTimersByTime(200); });
    rerender({ search: "ang" });
    await act(async () => { jest.advanceTimersByTime(349); });
    expect(axiosAuth.get).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(axiosAuth.get).toHaveBeenCalledTimes(2);
    expect(jest.mocked(axiosAuth.get).mock.calls[1][0]).toContain("search=ang");
    expect(result.current.isDebouncing).toBe(false);
  } finally {
    unmount();
    client.clear();
    jest.useRealTimers();
  }
});

it("aborts a pending page when the query changes or its view unmounts", async () => {
  jest.mocked(axiosAuth.get).mockImplementation(() => new Promise(() => {}));
  const { client, wrapper } = setup();
  const { rerender, unmount } = renderHook(
    ({ page }) => useBusinessSalesPage(["store-a"], { ...initialQuery, page }),
    { wrapper, initialProps: { page: 1 } },
  );
  await waitFor(() => expect(axiosAuth.get).toHaveBeenCalledTimes(1));
  const firstSignal = jest.mocked(axiosAuth.get).mock.calls[0][1]?.signal;
  expect(firstSignal?.aborted).toBe(false);
  rerender({ page: 2 });
  expect(firstSignal?.aborted).toBe(true);
  await waitFor(() => expect(axiosAuth.get).toHaveBeenCalledTimes(2));
  const secondSignal = jest.mocked(axiosAuth.get).mock.calls[1][1]?.signal;
  expect(secondSignal?.aborted).toBe(false);
  unmount();
  expect(secondSignal?.aborted).toBe(true);
  client.clear();
});

it("does not request pages before both actor/company and explicit stores exist", () => {
  const { client, wrapper } = setup();
  jest.mocked(useAuth).mockReturnValue({ auth: null } as ReturnType<typeof useAuth>);
  const { result, rerender, unmount } = renderHook(
    ({ ids }) => useBusinessSalesPage(ids, initialQuery),
    { wrapper, initialProps: { ids: ["store-a"] } },
  );
  expect(result.current.fetchStatus).toBe("idle");
  expect(axiosAuth.get).not.toHaveBeenCalled();
  jest.mocked(useAuth).mockReturnValue(session());
  rerender({ ids: [] });
  expect(result.current.fetchStatus).toBe("idle");
  expect(axiosAuth.get).not.toHaveBeenCalled();
  unmount();
  client.clear();
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { AxiosError } from "axios";
import axios from "axios";
import type { ReactNode } from "react";
import { useAdvertisingMetaCatalog } from "@/hooks/useAdvertisingMeta";
import { getMetaAdDetail, getMetaCatalog, syncMetaModule } from "../advertisingMetaService";

jest.mock("axios");
const previousBase = process.env.NEXT_PUBLIC_API_INTEGRATIONS;
const get = jest.mocked(axios.get);
const post = jest.mocked(axios.post);
const filters = {
  from: "2026-10-01",
  to: "2026-10-08",
  level: "ad" as const,
  page: 2,
  pageSize: 50,
  currency: "PEN",
  sortBy: "spend" as const,
};
const root = "https://integrations.example.test/advertising/companies/company/meta";
beforeEach(() => {
  jest.resetAllMocks();
  process.env.NEXT_PUBLIC_API_INTEGRATIONS = "https://integrations.example.test";
  jest
    .mocked(axios.isAxiosError)
    .mockImplementation(
      (value: unknown): value is AxiosError =>
        typeof value === "object" && value !== null && "isAxiosError" in value,
    );
});
afterAll(() => {
  if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_INTEGRATIONS;
  else process.env.NEXT_PUBLIC_API_INTEGRATIONS = previousBase;
});

it("reads paginated Meta reports without changing data or losing decimals/nulls", async () => {
  const data = {
    rows: [{ insights: { spend: "1000000000000000000.01", clicks: null, actions: null } }],
  };
  get.mockResolvedValue({ data });
  const signal = new AbortController().signal;
  await expect(getMetaCatalog("token", "company", filters, signal)).resolves.toBe(data);
  expect(get).toHaveBeenCalledWith(
    `${root}/catalog`,
    expect.objectContaining({
      params: filters,
      signal,
      withCredentials: false,
      headers: { Authorization: "Bearer token" },
    }),
  );
  expect(post).not.toHaveBeenCalled();
});

it("scopes an ad detail to its company, account and period and syncs only explicitly", async () => {
  get.mockResolvedValue({ data: { row: { id: "123" } } });
  post.mockResolvedValue({ data: { runs: [] } });
  await getMetaAdDetail("token", "company", "123", {
    from: filters.from,
    to: filters.to,
    accountId: "account",
  });
  expect(get).toHaveBeenCalledWith(
    `${root}/ads/123`,
    expect.objectContaining({
      params: { from: filters.from, to: filters.to, accountId: "account" },
    }),
  );
  expect(post).not.toHaveBeenCalled();
  await syncMetaModule("token", "company", { from: filters.from, to: filters.to });
  expect(post).toHaveBeenCalledWith(
    `${root}/module-sync`,
    { from: filters.from, to: filters.to },
    expect.objectContaining({ timeout: 180_000 }),
  );
});

it("hides retained Meta data after access is denied on revalidation", async () => {
  get.mockResolvedValueOnce({ data: { source: "meta", rows: [], accounts: [] } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(
    () =>
      useAdvertisingMetaCatalog({
        token: "token",
        actorId: "actor",
        companyId: "company",
        ...filters,
      }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.data?.source).toBe("meta"));
  get.mockRejectedValue({ isAxiosError: true, response: { status: 403 } });
  await act(async () => {
    await result.current.refetch();
  });
  await waitFor(() => expect(result.current.isAccessDenied).toBe(true));
  expect(result.current.data).toBeUndefined();
  unmount();
  client.clear();
});

it("does not request a catalog without tenant identity or while the period is disabled", () => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(
    () =>
      useAdvertisingMetaCatalog({
        token: "token",
        actorId: null,
        companyId: "company",
        enabled: false,
        ...filters,
      }),
    { wrapper },
  );
  expect(result.current.data).toBeUndefined();
  expect(get).not.toHaveBeenCalled();
  unmount();
  client.clear();
});

it("keeps conversion and global cost ordering in the request and query identity", async () => {
  get.mockImplementation(async (_url, config) => ({
    data: {
      source: "meta",
      accounts: [],
      rows: [{ id: config?.params.resultType }],
    },
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender, unmount } = renderHook(
    ({ resultType }: { resultType: "messages" | "webPurchases" }) =>
      useAdvertisingMetaCatalog({
        token: "token",
        actorId: "actor",
        companyId: "company",
        ...filters,
        resultType,
        sortBy: "costPerResult",
        sortOrder: "asc",
      }),
    { wrapper, initialProps: { resultType: "messages" } },
  );
  await waitFor(() => expect(result.current.data?.rows[0].id).toBe("messages"));
  rerender({ resultType: "webPurchases" });
  await waitFor(() => expect(result.current.data?.rows[0].id).toBe("webPurchases"));
  expect(get).toHaveBeenLastCalledWith(
    `${root}/catalog`,
    expect.objectContaining({
      params: expect.objectContaining({
        resultType: "webPurchases",
        sortBy: "costPerResult",
        sortOrder: "asc",
        page: 2,
        currency: "PEN",
      }),
    }),
  );
  expect(post).not.toHaveBeenCalled();
  unmount();
  client.clear();
});

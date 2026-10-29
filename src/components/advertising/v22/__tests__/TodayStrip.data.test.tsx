import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { TodayStrip } from "../Ads";
import type { AdsSummary } from "@/services/advertisingV22Service";

let mockSummary: AdsSummary;
let mockStoreId = "all";
const today = "2026-10-23";
const yesterday = "2026-10-22";
jest.mock("axios");
jest.mock("../Numbers", () => ({
  useNumbers: () => ({ data: { summary: mockSummary, sales: { hourly: [] } }, isError: false }),
}));
jest.mock("../../AdvertisingStoreFilterContext", () => ({
  useAdvertisingStoreFilter: () => ({ storeId: mockStoreId }),
}));
jest.mock("../context", () => ({
  useAdsV22: () => ({ settings: { capabilities: { spend: true } } }),
  useAdsQuery: (
    key: unknown[],
    request: (id: unknown, signal: AbortSignal) => unknown,
    enabled: boolean,
  ) => {
    const { useQuery } = jest.requireActual("@tanstack/react-query");
    return useQuery({
      queryKey: key,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        request({ token: "token", companyId: "company" }, signal),
      enabled,
      retry: false,
    });
  },
}));
jest.mock("recharts", () => ({
  Bar: () => null,
  ResponsiveContainer: ({ children }: { children: unknown }) => children,
  BarChart: ({ data }: { data: unknown }) => (
    <div data-testid="hourly-chart" data-series={JSON.stringify(data)} />
  ),
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));
function scopes(todayAvailable: boolean, yesterdayAvailable: boolean, accountIds = ["account"]) {
  mockSummary.quality.spendScopes = [
    {
      storeId: mockStoreId,
      currency: "PEN",
      spendAvailable: todayAvailable && yesterdayAvailable,
      coverage: "partial",
      reasons: [],
      days: [
        {
          date: today,
          spendAvailable: todayAvailable,
          coverage: todayAvailable ? "complete" : "pending",
          reasons: [],
          accountIds,
        },
        {
          date: yesterday,
          spendAvailable: yesterdayAvailable,
          coverage: yesterdayAvailable ? "complete" : "pending",
          reasons: [],
          accountIds,
        },
      ],
    },
  ];
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TodayStrip />
    </QueryClientProvider>,
  );
  return client;
}
const gasto = () => screen.getByText("Gasto").parentElement!;
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-23T17:00:00-05:00"));
  mockStoreId = "all";
  process.env.NEXT_PUBLIC_API_INTEGRATIONS = "https://integrations.test";
  mockSummary = {
    days: [],
    quality: { warnings: [], coverage: "pending", spendAvailable: false },
  } as unknown as AdsSummary;
  (axios.get as jest.Mock).mockImplementation(async () => ({
    data: { rows: [], timeZone: "America/Lima" },
  }));
});
afterEach(() => jest.useRealTimers());

it("keeps absent Meta coverage pending instead of reporting an empty request batch as zero", () => {
  scopes(false, false);
  const client = mount();
  expect(gasto()).toHaveTextContent("—");
  expect(gasto()).not.toHaveTextContent(/S\//);
  expect(axios.get).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent("sin cobertura confirmada");
  client.clear();
});
it("does not sum just the observed account while a second relevant account is pending", () => {
  scopes(false, false, ["observed", "missing"]);
  mockSummary.days = [
    { accountId: "observed", adId: "ad", date: today, currency: "PEN", spend: "10" },
  ] as AdsSummary["days"];
  const client = mount();
  expect(gasto()).not.toHaveTextContent(/S\//);
  expect(axios.get).not.toHaveBeenCalled();
  client.clear();
});
it("preserves zero after confirmed accounts return a successful empty hourly report", async () => {
  scopes(true, true);
  const client = mount();
  await waitFor(() => expect(gasto()).toHaveTextContent(/S\/\s*0\.00/));
  expect(axios.get).toHaveBeenCalledTimes(1);
  client.clear();
});
it("requests every relevant account even when one has no saved ad observations", async () => {
  scopes(true, true, ["observed", "zero"]);
  mockSummary.days = [
    { accountId: "observed", adId: "ad", date: today, currency: "PEN", spend: "10" },
  ] as AdsSummary["days"];
  (axios.get as jest.Mock).mockImplementation(async (_url, options) => ({
    data: {
      rows:
        options.params.accountId === "observed"
          ? [{ date: today, hour: 0, spend: "10", adId: "ad" }]
          : [],
      timeZone: "America/Lima",
    },
  }));
  const client = mount();
  await waitFor(() => expect(gasto()).toHaveTextContent(/S\/\s*10\.00/));
  expect(
    (axios.get as jest.Mock).mock.calls.map(([, options]) => options.params.accountId),
  ).toEqual(["observed", "zero"]);
  client.clear();
});
it("retains yesterday's confirmed bars while keeping today's unconfirmed bars absent", async () => {
  scopes(false, true);
  (axios.get as jest.Mock).mockResolvedValue({
    data: {
      rows: [
        { date: today, hour: 0, spend: "20", adId: "ad" },
        { date: yesterday, hour: 0, spend: "10", adId: "ad" },
      ],
      timeZone: "America/Lima",
    },
  });
  const client = mount();
  await waitFor(() =>
    expect(JSON.parse(screen.getByTestId("hourly-chart").dataset.series!)[0].yesterday).toBe(10),
  );
  expect(JSON.parse(screen.getByTestId("hourly-chart").dataset.series!)[0].today).toBeNull();
  expect(gasto()).not.toHaveTextContent(/S\//);
  client.clear();
});
it("preserves a confirmed store zero when no advertising accounts are relevant to that store", () => {
  mockStoreId = "other-store";
  scopes(true, true, []);
  mockSummary.quality.accountDays = [
    { accountId: "another-stores-account", currency: "PEN", date: today },
  ] as NonNullable<AdsSummary["quality"]["accountDays"]>;
  const client = mount();
  expect(gasto()).toHaveTextContent(/S\/\s*0\.00/);
  expect(axios.get).not.toHaveBeenCalled();
  client.clear();
});
it("keeps a local hourly cache miss unknown until the explicit Meta refresh", async () => {
  scopes(true, true);
  (axios.get as jest.Mock).mockResolvedValue({
    data: { rows: [], timeZone: "America/Lima", availability: "not_synced" },
  });
  const client = mount();
  await screen.findByText(/El desglose por hora aún no está sincronizado/);
  expect(gasto()).not.toHaveTextContent(/S\//);
  expect(JSON.parse(screen.getByTestId("hourly-chart").dataset.series!)[0].today).toBeNull();
  client.clear();
});

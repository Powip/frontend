import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { adsGet, type AdsSettings } from "@/services/advertisingV22Service";
import { getNumbersV23, type AdsSalesV23, type AdsSummaryV23 } from "@/services/advertisingV23Service";
import { AdvertisingV22Provider } from "../context";
import { useRawNumbersV23 } from "../useRawNumbersV23";
import { useNumbers } from "../Numbers";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { user: { id: "actor" }, company: { id: "company" }, accessToken: "token" } }),
}));
jest.mock("@/services/advertisingV22Service", () => ({
  ...jest.requireActual("@/services/advertisingV22Service"), adsGet: jest.fn(),
}));
jest.mock("@/services/advertisingV23Service", () => ({ getNumbersV23: jest.fn() }));
const settings = { version: 1, capabilities: { view: true, spend: true, profit: true } } as AdsSettings;
const summary = { from: "2026-10-01", to: "2026-10-25", settings } as AdsSummaryV23;
const groups = [{ storeId: "store", channel: "WHATSAPP", channelFamily: "messages" }];
const sales = { from: summary.from, to: summary.to, byStore: groups, byChannel: groups,
  byProduct: groups, byAd: groups, daily: groups } as unknown as AdsSalesV23;
let client: QueryClient;
function Consumers({ storeId = "store", accountId = "all" }) {
  const raw = useRawNumbersV23(summary.from, summary.to);
  const legacy = useNumbers(summary.from, summary.to, storeId, "ads", accountId);
  const row = legacy.data?.sales.byChannel[0] as { channel: string; realChannel: string } | undefined;
  return <>
    <p>{raw.data?.sales.byChannel[0].channel ?? "raw pending"}</p>
    <p>{row ? `${row.channel}:${row.realChannel}` : "legacy pending"}</p>
  </>;
}
function App(props: { storeId?: string; accountId?: string }) {
  return <QueryClientProvider client={client}><AdvertisingV22Provider>
    <Consumers {...props} />
  </AdvertisingV22Provider></QueryClientProvider>;
}
beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.mocked(adsGet).mockResolvedValue(settings);
  jest.mocked(getNumbersV23).mockResolvedValue({ summary, sales });
});
afterEach(() => client.clear());
it("deduplicates raw and legacy consumers without mutating the cached raw channel", async () => {
  render(<App />);
  await screen.findByText("WHATSAPP");
  await screen.findByText("messages:WHATSAPP");
  expect(getNumbersV23).toHaveBeenCalledTimes(1);
  const cached = client.getQueryCache().findAll().find((q) => q.queryKey.includes("numbers-v23"))?.state.data as { sales: AdsSalesV23 };
  expect(cached.sales.byChannel[0].channel).toBe("WHATSAPP");
  expect(cached.sales.byChannel[0]).not.toHaveProperty("realChannel");
});
it("applies store and account filters after the same complete pool, without another network read", async () => {
  const ui = render(<App />);
  await screen.findByText("messages:WHATSAPP");
  ui.rerender(<App storeId="other-store" accountId="other-account" />);
  await waitFor(() => expect(getNumbersV23).toHaveBeenCalledTimes(1));
  expect(screen.getByText("messages:WHATSAPP")).toBeInTheDocument();
});

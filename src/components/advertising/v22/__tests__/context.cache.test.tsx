import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { adsGet, type AdsSettings } from "@/services/advertisingV22Service";
import { AdvertisingApiError } from "@/services/advertisingService";
import { AdvertisingV22Provider, useAdsQuery, useAdsV22, useRefreshAds } from "../context";

let mockAuth = { user: { id: "actor" }, company: { id: "company" }, accessToken: "token" };
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@/services/advertisingV22Service", () => ({ adsGet: jest.fn() }));
let settings: AdsSettings;
let failRead: number | undefined;
let reads: string[];
let resolveRead: ((value: { value: string }) => void) | undefined;
let holdRead: boolean;
let signals: Array<AbortSignal | undefined>;
let holdSettings: boolean;
let resolveSettings: ((value: AdsSettings) => void) | undefined;
let client: QueryClient;
const exposures: Array<{ profit: boolean; value: string | undefined }> = [];
function Probe({ scope = "all" }: { scope?: string }) {
  const query = useAdsQuery(["resource", scope], (identity, signal) =>
    adsGet<{ value: string }>(identity, "/resource", { scope }, signal),
  );
  const access = useAdsV22();
  const refresh = useRefreshAds();
  exposures.push({ profit: access.settings?.capabilities.profit === true, value: query.data?.value });
  return <>
    <p data-testid="data">{query.data?.value ?? "none"}</p>
    <p data-testid="access">{access.error ? "denied" : "allowed"}</p>
    <button onClick={() => void query.refetch()}>Read again</button>
    <button onClick={() => void access.reload()}>Verify access</button>
    <button onClick={() => void refresh()}>Refresh data</button>
  </>;
}
function App({ visible = true, scope = "all", providerKey = "same" }: { visible?: boolean; scope?: string; providerKey?: string }) {
  return <QueryClientProvider client={client}>
    <AdvertisingV22Provider key={providerKey}>{visible && <Probe scope={scope} />}</AdvertisingV22Provider>
  </QueryClientProvider>;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { user: { id: "actor" }, company: { id: "company" }, accessToken: "token" };
  settings = { version: 1, capabilities: { view: true, spend: true, profit: true, edit: false } } as AdsSettings;
  failRead = undefined;
  holdRead = false;
  holdSettings = false;
  resolveSettings = undefined;
  resolveRead = undefined;
  reads = [];
  signals = [];
  exposures.length = 0;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.mocked(adsGet).mockImplementation(async (identity, path, params, signal) => {
    if (path === "/v22/settings") {
      if (holdSettings) return new Promise((resolve) => { resolveSettings = resolve; }) as never;
      return JSON.parse(JSON.stringify(settings)) as never;
    }
    reads.push(`${identity.companyId}:${params?.scope}:${identity.token}`);
    signals.push(signal);
    if (failRead) throw new AdvertisingApiError("Access denied", failRead);
    if (holdRead) return new Promise((resolve) => { resolveRead = resolve; }) as never;
    return { value: `${identity.companyId}:${params?.scope}:${settings.capabilities.profit ? "profit" : "public"}` } as never;
  });
});
afterEach(() => { client.clear(); jest.restoreAllMocks(); });

it("reuses a recently read section and refreshes after the 30 second freshness window", async () => {
  const now = Date.now();
  const time = jest.spyOn(Date, "now").mockReturnValue(now);
  const ui = render(<App />);
  await screen.findByText("company:all:profit");
  await waitFor(() => expect(reads).toHaveLength(1));
  ui.rerender(<App visible={false} />);
  ui.rerender(<App />);
  expect(screen.getByTestId("data")).toHaveTextContent("company:all:profit");
  expect(reads).toHaveLength(1);
  time.mockReturnValue(now + 30_001);
  ui.rerender(<App visible={false} />);
  ui.rerender(<App />);
  await waitFor(() => expect(reads).toHaveLength(2));
});

it("never substitutes rows from the previous filter while the new filter loads", async () => {
  const ui = render(<App scope="first" />);
  await screen.findByText("company:first:profit");
  holdRead = true;
  ui.rerender(<App scope="second" />);
  expect(screen.getByTestId("data")).toHaveTextContent("none");
  await waitFor(() => expect(resolveRead).toBeDefined());
  await act(async () => { resolveRead!({ value: "company:second:profit" }); });
  await screen.findByText("company:second:profit");
});

it("aborts an obsolete filter request and ignores its late response", async () => {
  holdRead = true;
  const ui = render(<App scope="first" />);
  await waitFor(() => expect(reads).toHaveLength(1));
  const obsolete = resolveRead!;
  ui.rerender(<App scope="second" />);
  await waitFor(() => expect(reads).toHaveLength(2));
  const current = resolveRead!;
  expect(signals[0]?.aborted).toBe(true);
  await act(async () => { obsolete({ value: "obsolete first filter" }); });
  expect(screen.getByTestId("data")).toHaveTextContent("none");
  await act(async () => { current({ value: "current second filter" }); });
  await screen.findByText("current second filter");
  expect(screen.queryByText("obsolete first filter")).not.toBeInTheDocument();
});

it("partitions and purges data when the actor or company changes", async () => {
  const ui = render(<App />);
  await screen.findByText("company:all:profit");
  mockAuth = { ...mockAuth, user: { id: "other-actor" }, company: { id: "other-company" } };
  ui.rerender(<App />);
  expect(screen.getByTestId("data")).toHaveTextContent("none");
  await screen.findByText("other-company:all:profit");
  expect(client.getQueryCache().findAll({ predicate: (q) => q.queryKey[3] === "data" })
    .every((q) => q.queryKey[1] === "other-actor" && q.queryKey[2] === "other-company")).toBe(true);
});

it("purges the old token's cached data before authorizing and reading again", async () => {
  const ui = render(<App />);
  await screen.findByText("company:all:profit");
  mockAuth = { ...mockAuth, accessToken: "new-token" };
  ui.rerender(<App />);
  expect(screen.getByTestId("data")).toHaveTextContent("none");
  await waitFor(() => expect(reads).toEqual(["company:all:token", "company:all:new-token"]));
  await screen.findByText("company:all:profit");
});

it("gates a remounted provider with a new token until fresh settings confirm its reduced permissions", async () => {
  const ui = render(<App />);
  await screen.findByText("company:all:profit");
  holdSettings = true;
  mockAuth = { ...mockAuth, accessToken: "new-token" };
  ui.rerender(<App providerKey="new-provider" />);
  expect(screen.getByTestId("data")).toHaveTextContent("none");
  await waitFor(() => expect(resolveSettings).toBeDefined());
  expect(screen.queryByText("company:all:profit")).not.toBeInTheDocument();
  settings = { ...settings, capabilities: { ...settings.capabilities, profit: false } };
  await act(async () => { resolveSettings!(settings); });
  await screen.findByText("company:all:public");
  expect(exposures.some((e) => !e.profit && e.value?.includes("profit"))).toBe(false);
});

it("ignores a cancelled request's late 403 after a new token has already loaded data", async () => {
  let rejectOld: ((error: unknown) => void) | undefined;
  const request = jest.mocked(adsGet).getMockImplementation()!;
  jest.mocked(adsGet).mockImplementation(async (identity, path, params, signal) => {
    if (path === "/resource" && identity.token === "token") {
      signals.push(signal);
      return new Promise((_resolve, reject) => { rejectOld = reject; }) as never;
    }
    return request(identity, path, params, signal);
  });
  const ui = render(<App />);
  await waitFor(() => expect(rejectOld).toBeDefined());
  mockAuth = { ...mockAuth, accessToken: "new-token" };
  ui.rerender(<App />);
  await screen.findByText("company:all:profit");
  expect(signals[0]?.aborted).toBe(true);
  await act(async () => { rejectOld!(new AdvertisingApiError("Old token expired", 403)); });
  expect(screen.getByTestId("access")).toHaveTextContent("allowed");
  expect(screen.getByTestId("data")).toHaveTextContent("company:all:profit");
});

it("never reuses profit data after a permission downgrade with the same settings version", async () => {
  render(<App />);
  await screen.findByText("company:all:profit");
  settings = { ...settings, capabilities: { ...settings.capabilities, profit: false } };
  fireEvent.click(screen.getByText("Verify access"));
  await screen.findByText("company:all:public");
  expect(exposures.some((e) => !e.profit && e.value?.includes("profit"))).toBe(false);
  expect(client.getQueryCache().findAll({ predicate: (q) => q.queryKey[3] === "data" })
    .some((q) => JSON.stringify(q.state.data).includes("profit"))).toBe(false);
});

it("clears cached data and stops reads when view access is revoked", async () => {
  render(<App />);
  await screen.findByText("company:all:profit");
  settings = { ...settings, capabilities: { ...settings.capabilities, view: false } };
  fireEvent.click(screen.getByText("Verify access"));
  await waitFor(() => expect(screen.getByTestId("data")).toHaveTextContent("none"));
  await waitFor(() => expect(client.getQueryCache().findAll({ predicate: (q) => q.queryKey[3] === "data" })
    .every((q) => q.state.data === undefined)).toBe(true));
  expect(reads).toHaveLength(1);
});

it.each([401, 403])("purges data after %s and requires access verification before another read", async (status) => {
  render(<App />);
  await screen.findByText("company:all:profit");
  failRead = status;
  fireEvent.click(screen.getByText("Read again"));
  await waitFor(() => expect(screen.getByTestId("access")).toHaveTextContent("denied"));
  expect(screen.getByTestId("data")).toHaveTextContent("none");
  await waitFor(() => expect(client.getQueryCache().findAll({ predicate: (q) => q.queryKey[3] === "data" })
    .every((q) => q.state.data === undefined)).toBe(true));
  expect(reads).toHaveLength(2);
  failRead = undefined;
  fireEvent.click(screen.getByText("Verify access"));
  await screen.findByText("company:all:profit");
  expect(reads).toHaveLength(3);
});

it("refreshes settings only once when refreshing all active advertising data", async () => {
  render(<App />);
  await screen.findByText("company:all:profit");
  fireEvent.click(screen.getByText("Refresh data"));
  await waitFor(() => expect(reads).toHaveLength(2));
  expect(jest.mocked(adsGet).mock.calls.filter(([, path]) => path === "/v22/settings")).toHaveLength(2);
});

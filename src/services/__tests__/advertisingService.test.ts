import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { AxiosError } from "axios";
import axios from "axios";
import React from "react";
import { advertisingSnapshotKey, useAdvertisingSnapshot } from "@/hooks/useAdvertisingSnapshot";
import type { AdvertisingLocalManualRecord, AdvertisingSnapshotWire } from "../advertisingService";
import {
  AdvertisingApiError,
  advertisingApiBase,
  advertisingErrorMessage,
  batchAdvertisingManualRecords,
  completeAdvertisingAuthorization,
  discoverAdvertisingAccounts,
  getAdvertisingSnapshot,
  importAdvertisingManualRecords,
  pauseAdvertisingUpdates,
  previewAdvertisingManualImport,
  selectAdvertisingAccounts,
  startAdvertisingAuthorization,
  syncAdvertisingSpend,
} from "../advertisingService";

jest.mock("axios");
const get = jest.mocked(axios.get);
const post = jest.mocked(axios.post);
const put = jest.mocked(axios.put);
const COMPANY_ID = "b2222222-2222-4222-8222-222222222222";
const ACTOR_ID = "a1111111-1111-4111-8111-111111111111";
const OTHER_ACTOR_ID = "c3333333-3333-4333-8333-333333333333";
const TOKEN = "test-access-token";
const BASE = "https://integrations.example.test";
const ROOT = `${BASE}/advertising/companies/${COMPANY_ID}`;
const previousBase = process.env.NEXT_PUBLIC_API_INTEGRATIONS;

function snapshot(): AdvertisingSnapshotWire {
  return {
    accounts: [
      {
        id: "account-id",
        provider: "meta",
        externalId: "123",
        name: "Cuenta de prueba",
        currency: "PEN",
        timeZone: "America/Lima",
        enabled: true,
        connectionId: "connection-id",
        syncFrom: "2026-10-01",
        lastAttemptAt: null,
        lastSuccessfulAt: null,
        updatedAt: null,
      },
    ],
    days: [
      {
        accountId: "account-id",
        date: "2026-10-01",
        amount: "100.123450",
        currency: "PEN",
        provisional: false,
        sourceRevision: null,
        updatedAt: "2026-10-09T10:00:00Z",
      },
      {
        accountId: "account-id",
        date: "2026-10-02",
        amount: null,
        currency: "PEN",
        provisional: true,
        sourceRevision: null,
        updatedAt: "2026-10-09T10:00:00Z",
      },
    ],
    manualRecords: [],
    providers: {
      meta: { available: true, status: "connected" },
      tiktok: { available: false, status: "disconnected" },
    },
    capabilities: { canManage: false, canReconcile: false },
    today: "2026-10-09",
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  process.env.NEXT_PUBLIC_API_INTEGRATIONS = BASE;
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

describe("advertising service", () => {
  it("preserves every original while splitting by record count and actual UTF-8 request size", () => {
    const record = (index: number, text = ""): AdvertisingLocalManualRecord => ({
      source: "pauta",
      sourceId: `original-${index}`,
      browserKey: "browser-id",
      date: "2026-10-09",
      amount: "100.005",
      currency: null,
      payload: { text },
    });
    const small = Array.from({ length: 201 }, (_, index) => record(index));
    const unicode = Array.from({ length: 10 }, (_, index) => record(index, "á".repeat(5000)));
    expect(batchAdvertisingManualRecords(small).map((batch) => batch.length)).toEqual([200, 1]);
    expect(batchAdvertisingManualRecords(unicode).length).toBeGreaterThan(1);
    for (const originals of [small, unicode]) {
      const batches = batchAdvertisingManualRecords(originals);
      expect(batches.flat()).toEqual(originals);
      for (const records of batches) {
        expect(records.length).toBeLessThanOrEqual(200);
        expect(Buffer.byteLength(JSON.stringify({ records }), "utf8")).toBeLessThanOrEqual(
          90 * 1024,
        );
      }
    }
  });

  it("previews and imports originals with Bearer authentication without inferring their currency", async () => {
    const records: AdvertisingLocalManualRecord[] = [
      {
        source: "cierre",
        sourceId: "store-id:2026-10-09:meta",
        browserKey: "browser-id",
        date: "2026-10-09",
        amount: "100.005",
        currency: null,
        payload: { original: { publiMeta: "100.005" }, storeId: "store-id" },
      },
    ];
    const result = { entries: [], counts: { new: 1, existing: 0, conflict: 0, total: 1 } };
    const signal = new AbortController().signal;
    post.mockResolvedValue({ data: result });
    await expect(previewAdvertisingManualImport(TOKEN, COMPANY_ID, records, signal)).resolves.toBe(
      result,
    );
    await expect(importAdvertisingManualRecords(TOKEN, COMPANY_ID, records)).resolves.toBe(result);
    expect(post).toHaveBeenNthCalledWith(
      1,
      `${ROOT}/manual/preview`,
      { records },
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
        timeout: 30_000,
        withCredentials: false,
        signal,
      },
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      `${ROOT}/manual/import`,
      { records },
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
        timeout: 30_000,
        withCredentials: false,
        signal: undefined,
      },
    );
    expect(records[0].currency).toBeNull();
    expect(records[0].amount).toBe("100.005");
  });

  it("preserves decimals, missing values and server capabilities with an abortable snapshot request", async () => {
    const data = snapshot();
    const controller = new AbortController();
    get.mockResolvedValue({ data });
    await expect(
      getAdvertisingSnapshot(TOKEN, COMPANY_ID, "2026-10-01", "2026-10-08", controller.signal),
    ).resolves.toBe(data);
    expect(get).toHaveBeenCalledWith(`${ROOT}/snapshot`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      params: { from: "2026-10-01", to: "2026-10-08" },
      timeout: 30_000,
      withCredentials: false,
      signal: controller.signal,
    });
    expect(data.days.map((day) => day.amount)).toEqual(["100.123450", null]);
  });

  it("does not turn an unavailable or forbidden backend into an empty successful snapshot", async () => {
    const denial = {
      isAxiosError: true,
      response: { status: 403, data: "private backend detail" },
    };
    get.mockRejectedValue(denial);
    await expect(
      getAdvertisingSnapshot(TOKEN, COMPANY_ID, "2026-10-01", "2026-10-08"),
    ).rejects.toBe(denial);
  });

  it("requires a configured backend instead of falling back to an unrelated local port", async () => {
    delete process.env.NEXT_PUBLIC_API_INTEGRATIONS;
    await expect(
      getAdvertisingSnapshot(TOKEN, COMPANY_ID, "2026-10-01", "2026-10-08"),
    ).rejects.toMatchObject({ status: 503 });
    expect(get).not.toHaveBeenCalled();
    expect(
      advertisingErrorMessage(
        new AdvertisingApiError("La conexión de publicidad aún no está configurada.", 503),
      ),
    ).toMatch(/no está configurada/);
  });

  it.each([
    "http://public.example.test",
    "https://user:password@example.test",
    "https://example.test?token=value",
    "https://example.test#fragment",
    "file:///tmp/backend",
  ])("rejects unsafe backend origins %s", (origin) => {
    process.env.NEXT_PUBLIC_API_INTEGRATIONS = origin;
    expect(advertisingApiBase).toThrow(AdvertisingApiError);
  });

  it("supports an explicit local backend in development and normalizes trailing slashes", () => {
    process.env.NEXT_PUBLIC_API_INTEGRATIONS = "http://127.0.0.1:3007/";
    expect(advertisingApiBase()).toBe("http://127.0.0.1:3007");
  });

  it("requires an access token for both authorization start and callback completion", async () => {
    post.mockResolvedValueOnce({ data: { url: "https://provider.example.test/authorize" } });
    await startAdvertisingAuthorization(TOKEN, COMPANY_ID, "meta");
    const payload = { state: "opaque-state", code: "one-use-code" };
    post.mockResolvedValueOnce({ data: { connected: true } });
    await expect(
      completeAdvertisingAuthorization(TOKEN, COMPANY_ID, "meta", payload),
    ).resolves.toEqual({ connected: true });
    expect(post).toHaveBeenNthCalledWith(
      1,
      `${ROOT}/meta/authorization`,
      {},
      expect.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } }),
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      `${ROOT}/meta/callback`,
      payload,
      expect.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } }),
    );
    await expect(
      completeAdvertisingAuthorization("", COMPANY_ID, "meta", payload),
    ).rejects.toMatchObject({ status: 401 });
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("discovers accounts without choosing them and sends only explicit selections", async () => {
    const accounts = [
      { externalId: "advertiser-1", name: "Cuenta", currency: "USD", timeZone: "UTC" },
    ];
    get.mockResolvedValue({ data: { accounts } });
    await expect(discoverAdvertisingAccounts(TOKEN, COMPANY_ID, "tiktok")).resolves.toEqual({
      accounts,
    });
    expect(get).toHaveBeenCalledWith(
      `${ROOT}/tiktok/accounts`,
      expect.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } }),
    );
    const selection = { externalIds: ["advertiser-1"], syncFrom: "2026-10-01" };
    put.mockResolvedValue({ data: { selectedCount: 1 } });
    await expect(
      selectAdvertisingAccounts(TOKEN, COMPANY_ID, "tiktok", selection),
    ).resolves.toEqual({ selectedCount: 1 });
    expect(put).toHaveBeenCalledWith(
      `${ROOT}/tiktok/accounts`,
      selection,
      expect.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } }),
    );
  });

  it("pauses without deleting history and returns per-account sync results", async () => {
    post.mockResolvedValueOnce({ data: { paused: true } });
    await pauseAdvertisingUpdates(TOKEN, COMPANY_ID, "meta");
    expect(post).toHaveBeenNthCalledWith(
      1,
      `${ROOT}/meta/pause`,
      {},
      expect.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } }),
    );
    const payload = { from: "2026-10-01", to: "2026-10-08" };
    const runs = [
      { accountId: "account-id", ...payload, status: "failed", errorCode: "PROVIDER_UNAVAILABLE" },
    ];
    post.mockResolvedValueOnce({ data: { runs } });
    await expect(syncAdvertisingSpend(TOKEN, COMPANY_ID, "meta", payload)).resolves.toEqual({
      runs,
    });
    expect(post).toHaveBeenNthCalledWith(
      2,
      `${ROOT}/meta/sync`,
      payload,
      expect.objectContaining({ timeout: 60_000 }),
    );
  });

  it.each([401, 403, 409, 429, 503])(
    "shows fixed messages for %s without exposing backend details",
    (status) => {
      const message = advertisingErrorMessage({
        isAxiosError: true,
        response: { status, data: "private-token-value" },
      });
      expect(message).not.toContain("private-token-value");
      expect(message).not.toContain(TOKEN);
    },
  );
});

describe("advertising snapshot query isolation", () => {
  function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children);
    return { client, wrapper };
  }
  const options = {
    token: TOKEN,
    actorId: ACTOR_ID,
    companyId: COMPANY_ID,
    from: "2026-10-01",
    to: "2026-10-08",
  };

  it("keys by actor and company without placing credentials in the cache key", async () => {
    const data = snapshot();
    get.mockResolvedValue({ data });
    const { client, wrapper } = setup();
    const view = renderHook(() => useAdvertisingSnapshot(options), { wrapper });
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    expect(client.getQueryCache().getAll()[0].queryKey).toEqual(
      advertisingSnapshotKey(ACTOR_ID, COMPANY_ID, options.from, options.to),
    );
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.queryKey),
      ),
    ).not.toContain(TOKEN);
    view.unmount();
    client.clear();
  });

  it("does not show another actor's cached snapshot while their own request is pending", async () => {
    get.mockResolvedValueOnce({ data: snapshot() });
    const { client, wrapper } = setup();
    const view = renderHook((props) => useAdvertisingSnapshot(props), {
      wrapper,
      initialProps: options,
    });
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    get.mockReturnValueOnce(new Promise(() => undefined));
    view.rerender({ ...options, actorId: OTHER_ACTOR_ID });
    expect(view.result.current.data).toBeUndefined();
    view.unmount();
    client.clear();
  });

  it.each([401, 403])("hides previously loaded amounts after a %s refetch", async (status) => {
    get.mockResolvedValueOnce({ data: snapshot() });
    const { client, wrapper } = setup();
    const view = renderHook(() => useAdvertisingSnapshot(options), { wrapper });
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    get.mockRejectedValueOnce({ isAxiosError: true, response: { status } });
    await act(async () => {
      await view.result.current.refetch();
    });
    await waitFor(() => expect(view.result.current.isAccessDenied).toBe(true));
    expect(view.result.current.data).toBeUndefined();
    view.unmount();
    client.clear();
  });

  it("does not request or display data without a token, actor or company", () => {
    const { client, wrapper } = setup();
    const view = renderHook((props) => useAdvertisingSnapshot(props), {
      wrapper,
      initialProps: { ...options, token: "" },
    });
    expect(view.result.current.data).toBeUndefined();
    view.rerender({ ...options, actorId: "" });
    view.rerender({ ...options, companyId: "" });
    expect(get).not.toHaveBeenCalled();
    view.unmount();
    client.clear();
  });

  it("aborts the HTTP request when the scope leaves the page", async () => {
    get.mockReturnValue(new Promise(() => undefined));
    const { client, wrapper } = setup();
    const view = renderHook(() => useAdvertisingSnapshot(options), { wrapper });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    const signal = get.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    view.unmount();
    expect(signal?.aborted).toBe(true);
    client.clear();
  });
});

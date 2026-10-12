import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { tokenStore } from "@/lib/tokenStore";
import { partnersKeys } from "../../keys/partners.keys";
import type { PartnerResource } from "../../models/partner-resource";
import { getPartnerResources } from "../../services/get-partner-resources";
import { usePartnerResources } from "../use-partner-resources";

let mockAuth: { user: { id: string }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("../../services/get-partner-resources", () => ({ getPartnerResources: jest.fn() }));

const mockGetPartnerResources = jest.mocked(getPartnerResources);

const MOCK_RESOURCE: PartnerResource = {
  id: "55555555-5555-4555-8555-555555555555",
  title: "Logos POWIP",
  description: "PNG · SVG",
  kind: "LOGOS",
  category: "Guide",
  downloadUrl: null,
};
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const TOKEN_A = "fixture-session-A";
const TOKEN_B = "fixture-session-B";
let queryClient: QueryClient;

function buildWrapper() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 300_000 } },
  });
  return function PartnersQueryTestWrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("usePartnerResources", () => {
  beforeEach(() => {
    mockAuth = { user: { id: USER_A }, accessToken: TOKEN_A };
    tokenStore.set(TOKEN_A);
    mockGetPartnerResources.mockReset();
  });
  afterEach(() => {
    cleanup();
    queryClient?.clear();
    tokenStore.set(null);
  });

  it("está en isLoading antes de que resuelva el service", () => {
    mockGetPartnerResources.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePartnerResources(), { wrapper: buildWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(getPartnerResources).toHaveBeenCalledWith(TOKEN_A, expect.any(AbortSignal));
  });

  it("expone data cuando el service resuelve", async () => {
    mockGetPartnerResources.mockResolvedValue([MOCK_RESOURCE]);
    const { result } = renderHook(() => usePartnerResources(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([MOCK_RESOURCE]);
  });

  it("expone isError cuando el service rechaza", async () => {
    mockGetPartnerResources.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => usePartnerResources(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it.each([
    null,
    { user: { id: USER_A }, accessToken: "" },
    { user: { id: "" }, accessToken: TOKEN_A },
  ])("never dispatches without complete current identity: %#", (auth) => {
    mockAuth = auth;
    const { result } = renderHook(() => usePartnerResources(), { wrapper: buildWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(getPartnerResources).not.toHaveBeenCalled();
  });

  it("does not dispatch after tokenStore has already changed", () => {
    tokenStore.set(TOKEN_B);
    renderHook(() => usePartnerResources(), { wrapper: buildWrapper() });
    expect(getPartnerResources).not.toHaveBeenCalled();
  });

  it("isolates A's fresh country-scoped resources from B", async () => {
    mockGetPartnerResources.mockResolvedValueOnce([MOCK_RESOURCE]);
    const pendingB = deferred<PartnerResource[]>();
    const { result, rerender } = renderHook(() => usePartnerResources(), {
      wrapper: buildWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    mockGetPartnerResources.mockReturnValueOnce(pendingB.promise);
    mockAuth = { user: { id: USER_B }, accessToken: TOKEN_B };
    tokenStore.set(TOKEN_B);
    rerender();
    expect(result.current.data).toBeUndefined();
    await act(async () => {
      pendingB.resolve([]);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(getPartnerResources).toHaveBeenLastCalledWith(TOKEN_B, expect.any(AbortSignal));
    expect(
      JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .map((query) => query.queryKey),
      ),
    ).not.toContain(TOKEN_B);
  });

  it("revalidates fresh resources on same-user A → B → A bearer changes", async () => {
    mockGetPartnerResources.mockResolvedValueOnce([MOCK_RESOURCE]);
    const { result, rerender } = renderHook(() => usePartnerResources(), {
      wrapper: buildWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const firstKey = queryClient.getQueryCache().getAll()[0].queryKey;

    const pendingB = deferred<PartnerResource[]>();
    mockGetPartnerResources.mockReturnValueOnce(pendingB.promise);
    mockAuth = { user: { id: USER_A }, accessToken: TOKEN_B };
    tokenStore.set(TOKEN_B);
    rerender();
    expect(result.current.data).toBeUndefined();
    expect(getPartnerResources).toHaveBeenLastCalledWith(TOKEN_B, expect.any(AbortSignal));
    await act(async () => pendingB.resolve([]));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);

    const pendingSecondA = deferred<PartnerResource[]>();
    mockGetPartnerResources.mockReturnValueOnce(pendingSecondA.promise);
    mockAuth = { user: { id: USER_A }, accessToken: TOKEN_A };
    tokenStore.set(TOKEN_A);
    rerender();
    expect(result.current.data).toBeUndefined();
    expect(getPartnerResources).toHaveBeenCalledTimes(3);
    await act(async () => pendingSecondA.resolve([]));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);

    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey);
    expect(keys).toHaveLength(3);
    expect(keys[2]).not.toEqual(firstKey);
    expect(JSON.stringify(keys)).not.toContain(TOKEN_A);
    expect(JSON.stringify(keys)).not.toContain(TOKEN_B);
    expect(keys.every((key) => key.includes(USER_A))).toBe(true);
  });

  it("does not expose fresh A resources after the same user's B request is denied", async () => {
    mockGetPartnerResources.mockResolvedValueOnce([MOCK_RESOURCE]);
    const { result, rerender } = renderHook(() => usePartnerResources(), {
      wrapper: buildWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const denied = Object.assign(new Error("Partner is not ACTIVE"), {
      response: { status: 403 },
    });
    mockGetPartnerResources.mockRejectedValueOnce(denied);
    mockAuth = { user: { id: USER_A }, accessToken: TOKEN_B };
    tokenStore.set(TOKEN_B);
    rerender();
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(denied);
    expect(result.current.data).toBeUndefined();
  });

  it("never lets a late A denial contaminate the same user's successful B resources", async () => {
    const pendingA = deferred<PartnerResource[]>();
    mockGetPartnerResources.mockReturnValueOnce(pendingA.promise);
    const { result, rerender } = renderHook(() => usePartnerResources(), {
      wrapper: buildWrapper(),
    });
    const firstKey = queryClient.getQueryCache().getAll()[0].queryKey;
    mockGetPartnerResources.mockResolvedValueOnce([]);
    mockAuth = { user: { id: USER_A }, accessToken: TOKEN_B };
    tokenStore.set(TOKEN_B);
    rerender();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      pendingA.reject(
        Object.assign(new Error("Old session revoked"), { response: { status: 401 } }),
      );
    });
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(queryClient.getQueryState(firstKey)?.error).toBeNull();
  });

  it("discards a stale denial even before auth rerenders with the new bearer", async () => {
    const pendingA = deferred<PartnerResource[]>();
    mockGetPartnerResources.mockReturnValueOnce(pendingA.promise);
    const { result } = renderHook(() => usePartnerResources(), { wrapper: buildWrapper() });
    const signal = mockGetPartnerResources.mock.calls[0][1];
    tokenStore.set(TOKEN_B);
    expect(signal?.aborted).toBe(false);
    await act(async () => {
      pendingA.reject(
        Object.assign(new Error("Old session denied"), { response: { status: 403 } }),
      );
    });
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeUndefined();
  });

  it("rejects a late response when token changes before auth rerender", async () => {
    const pending = deferred<PartnerResource[]>();
    mockGetPartnerResources.mockReturnValue(pending.promise);
    const { result } = renderHook(() => usePartnerResources(), { wrapper: buildWrapper() });
    tokenStore.set(TOKEN_B);
    await act(async () => {
      pending.resolve([MOCK_RESOURCE]);
    });
    expect(result.current.data).toBeUndefined();
    expect(
      queryClient
        .getQueryCache()
        .findAll({ queryKey: partnersKeys.all })
        .every((query) => query.state.data === undefined),
    ).toBe(true);
  });

  it("aborts on logout and never accepts its late response", async () => {
    const pending = deferred<PartnerResource[]>();
    mockGetPartnerResources.mockReturnValue(pending.promise);
    const { result, rerender } = renderHook(() => usePartnerResources(), {
      wrapper: buildWrapper(),
    });
    const signal = mockGetPartnerResources.mock.calls[0][1];
    mockAuth = null;
    tokenStore.set(null);
    rerender();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      pending.resolve([MOCK_RESOURCE]);
    });
    expect(result.current.data).toBeUndefined();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { tokenStore } from "@/lib/tokenStore";
import { requestPartnerReferralMetrics } from "../../api/partner-referral-metrics.api";
import { requestProgramPreferences } from "../../api/program-preferences.api";
import type { PartnerReferralMetrics } from "../../models/partner-referral-metrics";
import type { ProgramPreferencesResponse } from "../../models/program-preferences";
import { buildAxiosError } from "../../test-utils/axios-error";
import { programPreferencesFixture } from "../../test-utils/program-preferences.fixture";
import {
  adminReadDenialFor,
  clearAdminReadDenial,
  denyAdminReadSession,
} from "../../utils/admin-read-session-state";
import { clearProgramPreferencesDenial } from "../../utils/program-preferences-session-state";
import {
  partnerReferralMetricsQueryKey,
  usePartnerReferralMetrics,
} from "../use-partner-referral-metrics";
import { useProgramPreferences } from "../use-program-preferences";

let mockAuth: { user: { id: string }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("../../api/partner-referral-metrics.api", () => ({
  requestPartnerReferralMetrics: jest.fn(),
}));
jest.mock("../../api/program-preferences.api", () => ({ requestProgramPreferences: jest.fn() }));
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const metrics: PartnerReferralMetrics = {
  claimCaptures: 12,
  attachedClaims: 7,
  attributedCompanies: 4,
  asOf: "2026-10-11T10:00:00Z",
};
let client: QueryClient;
function wrapper() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
beforeEach(() => {
  clearAdminReadDenial();
  clearProgramPreferencesDenial();
  mockAuth = { user: { id: USER_A }, accessToken: "private-A" };
  tokenStore.set(mockAuth.accessToken);
  jest.mocked(requestPartnerReferralMetrics).mockReset().mockResolvedValue(metrics);
  jest.mocked(requestProgramPreferences).mockReset().mockResolvedValue(programPreferencesFixture());
});
afterEach(() => {
  cleanup();
  client?.clear();
  tokenStore.set(null);
  clearProgramPreferencesDenial();
  clearAdminReadDenial();
});

it("reads its separate owner/epoch key with captured bearer/abort, ignoring the old link cache", async () => {
  const { result } = renderHook(() => usePartnerReferralMetrics(), { wrapper: wrapper() });
  client.setQueryData(["partners", "link"], { clicks: 999, codeUses: 999, conversions: 999 });
  await waitFor(() => expect(result.current.data).toEqual(metrics));
  expect(requestPartnerReferralMetrics).toHaveBeenCalledWith({
    accessToken: "private-A",
    signal: expect.any(AbortSignal),
  });
  expect(result.current.session.queryKey).toEqual(
    partnerReferralMetricsQueryKey(USER_A, result.current.session.epoch),
  );
  expect(
    JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey),
    ),
  ).not.toContain("private-A");
});

it("does not dispatch for an anonymous session, even on explicit refetch", async () => {
  mockAuth = null;
  tokenStore.set(null);
  const { result } = renderHook(() => usePartnerReferralMetrics(), { wrapper: wrapper() });
  expect(result.current.session.enabled).toBe(false);
  await act(async () => {
    await result.current.refetch();
  });
  expect(requestPartnerReferralMetrics).not.toHaveBeenCalled();
  expect(result.current.data).toBeUndefined();
});

it("a current 403 hides/purges both own readers and rejects a late preferences response", async () => {
  const { result } = renderHook(
    () => ({ metrics: usePartnerReferralMetrics(), preferences: useProgramPreferences() }),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(result.current.preferences.data).toBeDefined());
  await waitFor(() => expect(result.current.metrics.data).toEqual(metrics));
  const pending = deferred<ProgramPreferencesResponse>();
  jest.mocked(requestProgramPreferences).mockReturnValueOnce(pending.promise);
  let refetch!: ReturnType<typeof result.current.preferences.refetch>;
  await act(async () => {
    refetch = result.current.preferences.refetch();
    await Promise.resolve();
  });
  await waitFor(() => expect(requestProgramPreferences).toHaveBeenCalledTimes(2));
  const signal = jest.mocked(requestProgramPreferences).mock.calls[1][0].signal;
  const denied = buildAxiosError(403);
  jest.mocked(requestPartnerReferralMetrics).mockRejectedValueOnce(denied);
  await act(async () => {
    await result.current.metrics.refetch();
  });
  await waitFor(() => expect(result.current.preferences.session.denied).toBe(denied));
  expect(result.current.metrics.data).toBeUndefined();
  expect(result.current.preferences.data).toBeUndefined();
  expect(signal?.aborted).toBe(true);
  expect(adminReadDenialFor(USER_A, "private-A")).toBeNull();
  await act(async () => {
    pending.resolve(programPreferencesFixture());
    await refetch;
  });
  expect(
    client
      .getQueryCache()
      .getAll()
      .some((query) => query.state.data !== undefined),
  ).toBe(false);
});

it("a renewed bearer aborts an old read and cannot render its late result", async () => {
  const pending = deferred<PartnerReferralMetrics>();
  jest.mocked(requestPartnerReferralMetrics).mockReturnValueOnce(pending.promise);
  const { result, rerender } = renderHook(() => usePartnerReferralMetrics(), {
    wrapper: wrapper(),
  });
  await waitFor(() => expect(requestPartnerReferralMetrics).toHaveBeenCalledTimes(1));
  const oldEpoch = result.current.session.epoch;
  const signal = jest.mocked(requestPartnerReferralMetrics).mock.calls[0][0].signal;
  const next = { ...metrics, claimCaptures: 0 };
  jest.mocked(requestPartnerReferralMetrics).mockResolvedValue(next);
  mockAuth = { user: { id: USER_A }, accessToken: "private-renewed" };
  tokenStore.set(mockAuth.accessToken);
  rerender();
  expect(signal?.aborted).toBe(true);
  expect(result.current.session.epoch).not.toBe(oldEpoch);
  expect(result.current.data).toBeUndefined();
  await act(async () => {
    pending.resolve(metrics);
  });
  await waitFor(() => expect(result.current.data).toEqual(next));
  expect(requestPartnerReferralMetrics).toHaveBeenLastCalledWith({
    accessToken: "private-renewed",
    signal: expect.any(AbortSignal),
  });
});

it("changing the user isolates counts even if the bearer string is unchanged", async () => {
  const { result, rerender } = renderHook(() => usePartnerReferralMetrics(), {
    wrapper: wrapper(),
  });
  await waitFor(() => expect(result.current.data).toEqual(metrics));
  const pending = deferred<PartnerReferralMetrics>();
  jest.mocked(requestPartnerReferralMetrics).mockReturnValueOnce(pending.promise);
  mockAuth = { user: { id: USER_B }, accessToken: "private-A" };
  rerender();
  expect(result.current.session.queryKey).toEqual(
    partnerReferralMetricsQueryKey(USER_B, result.current.session.epoch),
  );
  expect(result.current.data).toBeUndefined();
  await act(async () => {
    pending.resolve({ ...metrics, attachedClaims: 0 });
  });
  await waitFor(() => expect(result.current.data?.attachedClaims).toBe(0));
});

it("shared 401 cancels the in-flight metrics read and removes existing counts", async () => {
  const { result } = renderHook(() => usePartnerReferralMetrics(), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.data).toEqual(metrics));
  const pending = deferred<PartnerReferralMetrics>();
  jest.mocked(requestPartnerReferralMetrics).mockReturnValueOnce(pending.promise);
  let refetch!: ReturnType<typeof result.current.refetch>;
  await act(async () => {
    refetch = result.current.refetch();
    await Promise.resolve();
  });
  await waitFor(() => expect(requestPartnerReferralMetrics).toHaveBeenCalledTimes(2));
  const signal = jest.mocked(requestPartnerReferralMetrics).mock.calls[1][0].signal;
  const denied = buildAxiosError(401);
  await act(async () => {
    denyAdminReadSession(USER_A, "private-A", denied);
  });
  await waitFor(() => expect(signal?.aborted).toBe(true));
  expect(result.current.data).toBeUndefined();
  expect(result.current.session.denied).toBe(denied);
  await act(async () => {
    pending.resolve(metrics);
    await refetch;
  });
  expect(
    client
      .getQueryCache()
      .getAll()
      .some((query) => query.state.data !== undefined),
  ).toBe(false);
});

it("503 is a recoverable read error, never a zero fallback or sticky access denial", async () => {
  const failure = buildAxiosError(503);
  jest.mocked(requestPartnerReferralMetrics).mockRejectedValueOnce(failure);
  const { result } = renderHook(() => usePartnerReferralMetrics(), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
  expect(result.current.session.denied).toBeNull();
  expect(result.current.session.enabled).toBe(true);
  await act(async () => {
    await result.current.refetch();
  });
  await waitFor(() => expect(result.current.data).toEqual(metrics));
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { tokenStore } from "@/lib/tokenStore";
import {
  requestAdminBillingEvidence,
  requestAdminBillingEvidenceDetail,
} from "../../api/admin-billing-evidence.api";
import { requestPartnerReferralMetrics } from "../../api/partner-referral-metrics.api";
import { requestProgramPreferences } from "../../api/program-preferences.api";
import { partnersKeys } from "../../keys/partners.keys";
import { buildAxiosError } from "../../test-utils/axios-error";
import {
  BILLING_ID,
  BILLING_USER_A,
  BILLING_USER_B,
  billingEvidence,
  billingPage,
} from "../../test-utils/billing-evidence.fixture";
import { programPreferencesFixture } from "../../test-utils/program-preferences.fixture";
import { clearAdminCapabilityDenials } from "../../utils/admin-capability-session-state";
import { clearAdminReadDenial } from "../../utils/admin-read-session-state";
import { clearProgramPreferencesDenial } from "../../utils/program-preferences-session-state";
import {
  useAdminBillingEvidence,
  useAdminBillingEvidenceDetail,
} from "../use-admin-billing-evidence";
import { useAdminCapabilitySession } from "../use-admin-capability-session";
import { useAdminReadAccess } from "../use-admin-read-session";
import { usePartnerReferralMetrics } from "../use-partner-referral-metrics";
import { useProgramPreferences } from "../use-program-preferences";

let mockAuth: { user: { id: string; permissions: string[] }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("../../api/admin-billing-evidence.api", () => ({
  requestAdminBillingEvidence: jest.fn(),
  requestAdminBillingEvidenceDetail: jest.fn(),
}));
jest.mock("../../api/partner-referral-metrics.api", () => ({
  requestPartnerReferralMetrics: jest.fn(),
}));
jest.mock("../../api/program-preferences.api", () => ({ requestProgramPreferences: jest.fn() }));
let client: QueryClient;
function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { resolve, promise };
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300_000 } } });
  clearAdminReadDenial();
  clearAdminCapabilityDenials();
  clearProgramPreferencesDenial();
  mockAuth = {
    user: { id: BILLING_USER_A, permissions: ["PARTNERS_VIEW"] },
    accessToken: "private-A",
  };
  tokenStore.set("private-A");
  jest.mocked(requestAdminBillingEvidence).mockReset().mockResolvedValue(billingPage());
  jest.mocked(requestAdminBillingEvidenceDetail).mockReset().mockResolvedValue(billingEvidence());
  jest.mocked(requestProgramPreferences).mockReset().mockResolvedValue(programPreferencesFixture());
  jest.mocked(requestPartnerReferralMetrics).mockReset().mockResolvedValue({
    claimCaptures: 1,
    attachedClaims: 0,
    attributedCompanies: 0,
    asOf: "2026-10-11T12:00:00Z",
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  tokenStore.set(null);
  clearAdminReadDenial();
  clearAdminCapabilityDenials();
  clearProgramPreferencesDenial();
});

it("dispatches list and detail using pinned session and cancel signal; keys contain no bearer", async () => {
  const { result } = renderHook(
    () => ({
      list: useAdminBillingEvidence("RETRY", 5),
      detail: useAdminBillingEvidenceDetail(BILLING_ID),
    }),
    { wrapper: Wrapper },
  );
  await waitFor(() =>
    expect(result.current.list.isSuccess && result.current.detail.isSuccess).toBe(true),
  );
  expect(requestAdminBillingEvidence).toHaveBeenCalledWith(
    expect.objectContaining({
      accessToken: "private-A",
      cursor: null,
      state: "RETRY",
      limit: 5,
      signal: expect.any(AbortSignal),
    }),
  );
  expect(requestAdminBillingEvidenceDetail).toHaveBeenCalledWith(
    expect.objectContaining({
      accessToken: "private-A",
      evidenceId: BILLING_ID,
      signal: expect.any(AbortSignal),
    }),
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

it("follows server cursor without replaying the first page", async () => {
  jest
    .mocked(requestAdminBillingEvidence)
    .mockResolvedValueOnce(billingPage([billingEvidence()], { hasMore: true, nextCursor: "next" }))
    .mockResolvedValueOnce(billingPage([]));
  const { result } = renderHook(() => useAdminBillingEvidence(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.hasNextPage).toBe(true));
  await act(async () => {
    await result.current.fetchNextPage();
  });
  expect(requestAdminBillingEvidence).toHaveBeenLastCalledWith(
    expect.objectContaining({ cursor: "next" }),
  );
  await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
});

it.each([null, { user: { id: BILLING_USER_A, permissions: [] }, accessToken: "private-A" }])(
  "does not dispatch without VIEW: %#",
  (auth) => {
    mockAuth = auth;
    renderHook(
      () => {
        useAdminBillingEvidence();
        useAdminBillingEvidenceDetail(BILLING_ID);
      },
      { wrapper: Wrapper },
    );
    expect(requestAdminBillingEvidence).not.toHaveBeenCalled();
    expect(requestAdminBillingEvidenceDetail).not.toHaveBeenCalled();
  },
);

it("same user with a refreshed bearer cannot inherit earlier fresh data", async () => {
  const pending = deferred<ReturnType<typeof billingPage>>();
  const { result, rerender } = renderHook(() => useAdminBillingEvidence(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  jest.mocked(requestAdminBillingEvidence).mockReturnValueOnce(pending.promise);
  mockAuth = {
    user: { id: BILLING_USER_A, permissions: ["PARTNERS_VIEW"] },
    accessToken: "refreshed-A",
  };
  tokenStore.set("refreshed-A");
  rerender();
  expect(result.current.data).toBeUndefined();
  await act(async () => {
    pending.resolve(billingPage([]));
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.pages[0].items).toHaveLength(0);
});

it("late response from A cannot populate user B or revive A after logout", async () => {
  const pending = deferred<ReturnType<typeof billingEvidence>>();
  jest
    .mocked(requestAdminBillingEvidenceDetail)
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(billingEvidence({ invoiceId: "invoice-B" }));
  const { result, rerender } = renderHook(() => useAdminBillingEvidenceDetail(BILLING_ID), {
    wrapper: Wrapper,
  });
  const signal = jest.mocked(requestAdminBillingEvidenceDetail).mock.calls[0][0].signal;
  mockAuth = null;
  tokenStore.set(null);
  rerender();
  expect(signal?.aborted).toBe(true);
  mockAuth = {
    user: { id: BILLING_USER_B, permissions: ["PARTNERS_VIEW"] },
    accessToken: "private-B",
  };
  tokenStore.set("private-B");
  rerender();
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  await act(async () => {
    pending.resolve(billingEvidence());
  });
  expect(result.current.data?.invoiceId).toBe("invoice-B");
  expect(
    client
      .getQueriesData({ queryKey: partnersKeys.adminRead(BILLING_USER_A) })
      .every(([, data]) => data === undefined),
  ).toBe(true);
});

it.each([401, 403])(
  "detail HTTP%s purges the whole admin read family and hides a successful sibling",
  async (status) => {
    client.setQueryData([...partnersKeys.adminRead(BILLING_USER_A), "old-sibling"], {
      private: "old-data",
    });
    jest.mocked(requestAdminBillingEvidenceDetail).mockRejectedValue(buildAxiosError(status));
    const { result } = renderHook(
      () => ({
        list: useAdminBillingEvidence(),
        detail: useAdminBillingEvidenceDetail(BILLING_ID),
        access: useAdminReadAccess(),
      }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.access.denied).not.toBeNull());
    expect(
      client
        .getQueriesData({ queryKey: partnersKeys.adminRead(BILLING_USER_A) })
        .every(([, data]) => data === undefined),
    ).toBe(true);
  },
);

it("no selected detail and a tokenStore/auth mismatch never issue a request", () => {
  tokenStore.set("already-B");
  renderHook(
    () => {
      useAdminBillingEvidence();
      useAdminBillingEvidenceDetail(null);
    },
    { wrapper: Wrapper },
  );
  expect(requestAdminBillingEvidence).not.toHaveBeenCalled();
  expect(requestAdminBillingEvidenceDetail).not.toHaveBeenCalled();
});

it.each(["preferences", "metrics"] as const)(
  "401 originating in own %s cancels pending Billing reads, purges private data and prevents late revival",
  async (origin) => {
    if (mockAuth) mockAuth.user.permissions.push("PARTNERS_RESOLVE_REFERRAL");
    const { result } = renderHook(
      () => ({
        list: useAdminBillingEvidence(),
        detail: useAdminBillingEvidenceDetail(BILLING_ID),
        preferences: useProgramPreferences(),
        metrics: usePartnerReferralMetrics(),
        action: useAdminCapabilitySession("PARTNERS_RESOLVE_REFERRAL", "reviews"),
      }),
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(result.current.list.isSuccess && result.current.detail.isSuccess).toBe(true),
    );
    await waitFor(() =>
      expect(result.current.preferences.isSuccess && result.current.metrics.isSuccess).toBe(true),
    );
    const pendingList = deferred<ReturnType<typeof billingPage>>();
    const pendingDetail = deferred<ReturnType<typeof billingEvidence>>();
    jest.mocked(requestAdminBillingEvidence).mockReturnValueOnce(pendingList.promise);
    jest.mocked(requestAdminBillingEvidenceDetail).mockReturnValueOnce(pendingDetail.promise);
    let listRefetch!: ReturnType<typeof result.current.list.refetch>;
    let detailRefetch!: ReturnType<typeof result.current.detail.refetch>;
    act(() => {
      listRefetch = result.current.list.refetch();
      detailRefetch = result.current.detail.refetch();
    });
    await waitFor(() => expect(requestAdminBillingEvidence).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(requestAdminBillingEvidenceDetail).toHaveBeenCalledTimes(2));
    const listSignal = jest.mocked(requestAdminBillingEvidence).mock.calls[1][0].signal;
    const detailSignal = jest.mocked(requestAdminBillingEvidenceDetail).mock.calls[1][0].signal;
    const revoked = buildAxiosError(401);
    if (origin === "preferences")
      jest.mocked(requestProgramPreferences).mockRejectedValueOnce(revoked);
    else jest.mocked(requestPartnerReferralMetrics).mockRejectedValueOnce(revoked);
    await act(async () => {
      await result.current[origin].refetch();
    });
    await waitFor(() => expect(listSignal?.aborted && detailSignal?.aborted).toBe(true));
    expect(result.current.list.data).toBeUndefined();
    expect(result.current.detail.data).toBeUndefined();
    expect(result.current.list.error).toBe(revoked);
    expect(result.current.detail.error).toBe(revoked);
    expect(result.current.action.enabled).toBe(false);
    expect(
      client
        .getQueriesData({ queryKey: partnersKeys.adminRead(BILLING_USER_A) })
        .every(([, data]) => data === undefined),
    ).toBe(true);
    await act(async () => {
      pendingList.resolve(billingPage());
      pendingDetail.resolve(billingEvidence());
      await Promise.all([listRefetch, detailRefetch]);
    });
    expect(result.current.list.data).toBeUndefined();
    expect(result.current.detail.data).toBeUndefined();
    expect(
      client
        .getQueriesData({ queryKey: partnersKeys.adminRead(BILLING_USER_A) })
        .every(([, data]) => data === undefined),
    ).toBe(true);
  },
);

it("a Billing VIEW 403 purges/masks Billing only and does not revoke own readers or separate resolution capability", async () => {
  if (mockAuth) mockAuth.user.permissions.push("PARTNERS_RESOLVE_REFERRAL");
  const { result } = renderHook(
    () => ({
      list: useAdminBillingEvidence(),
      detail: useAdminBillingEvidenceDetail(BILLING_ID),
      preferences: useProgramPreferences(),
      metrics: usePartnerReferralMetrics(),
      action: useAdminCapabilitySession("PARTNERS_RESOLVE_REFERRAL", "reviews"),
    }),
    { wrapper: Wrapper },
  );
  await waitFor(() =>
    expect(
      result.current.list.isSuccess &&
        result.current.detail.isSuccess &&
        result.current.preferences.isSuccess &&
        result.current.metrics.isSuccess,
    ).toBe(true),
  );
  const forbidden = buildAxiosError(403);
  jest.mocked(requestAdminBillingEvidenceDetail).mockRejectedValueOnce(forbidden);
  await act(async () => {
    await result.current.detail.refetch();
  });
  await waitFor(() => expect(result.current.list.data).toBeUndefined());
  expect(result.current.detail.data).toBeUndefined();
  expect(result.current.list.error).toBe(forbidden);
  expect(result.current.preferences.data).toBeDefined();
  expect(result.current.metrics.data).toBeDefined();
  expect(result.current.action.enabled).toBe(true);
});

it.each(["preferences", "metrics"] as const)(
  "own %s 403 does not deny or remove separately authorized Billing VIEW data",
  async (origin) => {
    const { result } = renderHook(
      () => ({
        list: useAdminBillingEvidence(),
        preferences: useProgramPreferences(),
        metrics: usePartnerReferralMetrics(),
      }),
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(
        result.current.list.isSuccess &&
          result.current.preferences.isSuccess &&
          result.current.metrics.isSuccess,
      ).toBe(true),
    );
    if (origin === "preferences")
      jest.mocked(requestProgramPreferences).mockRejectedValueOnce(buildAxiosError(403));
    else jest.mocked(requestPartnerReferralMetrics).mockRejectedValueOnce(buildAxiosError(403));
    await act(async () => {
      await result.current[origin].refetch();
    });
    await waitFor(() => expect(result.current[origin].isError).toBe(true));
    expect(result.current.list.data?.pages[0].items).toHaveLength(1);
    expect(result.current.list.isSuccess).toBe(true);
  },
);

it("removed VIEW masks fresh cached list/detail immediately even without a new HTTP error", async () => {
  const { result, rerender } = renderHook(
    () => ({ list: useAdminBillingEvidence(), detail: useAdminBillingEvidenceDetail(BILLING_ID) }),
    { wrapper: Wrapper },
  );
  await waitFor(() =>
    expect(result.current.list.isSuccess && result.current.detail.isSuccess).toBe(true),
  );
  if (mockAuth) mockAuth = { ...mockAuth, user: { ...mockAuth.user, permissions: [] } };
  rerender();
  expect(result.current.list.data).toBeUndefined();
  expect(result.current.detail.data).toBeUndefined();
  expect(result.current.list.isSuccess).toBe(false);
  expect(result.current.detail.isSuccess).toBe(false);
});

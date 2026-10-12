import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { tokenStore } from "@/lib/tokenStore";
import {
  requestAdminFinancialBalance,
  requestAdminFinancialLedger,
} from "../../api/financial-ledger.api";
import { requestProgramPreferences } from "../../api/program-preferences.api";
import { partnersKeys } from "../../keys/partners.keys";
import type { FinancialLedgerBalance, FinancialLedgerPage } from "../../models/financial-ledger";
import { buildAxiosError } from "../../test-utils/axios-error";
import {
  ledgerBalanceFixture,
  ledgerEntryFixture,
  ledgerPageFixture,
} from "../../test-utils/financial-ledger.fixture";
import { programPreferencesFixture } from "../../test-utils/program-preferences.fixture";
import { clearAdminReadDenial, denyAdminReadSession } from "../../utils/admin-read-session-state";
import { clearProgramPreferencesDenial } from "../../utils/program-preferences-session-state";
import { useAdminFinancialBalance, useAdminFinancialLedger } from "../use-admin-financial-ledger";
import { useProgramPreferences } from "../use-program-preferences";

let mockAuth: { user: { id: string; permissions: string[] }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("../../api/financial-ledger.api", () => ({
  requestAdminFinancialLedger: jest.fn(),
  requestAdminFinancialBalance: jest.fn(),
}));
jest.mock("../../api/program-preferences.api", () => ({ requestProgramPreferences: jest.fn() }));
const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PARTNER = ledgerEntryFixture.partnerId;
const OTHER = "99999999-9999-4999-8999-999999999999";
let client: QueryClient;
function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function useReads(partnerId: string | null = PARTNER) {
  return {
    ledger: useAdminFinancialLedger(partnerId),
    balance: useAdminFinancialBalance(partnerId),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  clearAdminReadDenial();
  clearProgramPreferencesDenial();
  mockAuth = { user: { id: USER_A, permissions: ["PARTNERS_VIEW"] }, accessToken: "private-A" };
  tokenStore.set("private-A");
  jest
    .mocked(requestAdminFinancialLedger)
    .mockReset()
    .mockImplementation(async (request) =>
      ledgerPageFixture([{ ...ledgerEntryFixture, partnerId: request.partnerId }]),
    );
  jest
    .mocked(requestAdminFinancialBalance)
    .mockReset()
    .mockImplementation(async (request) => ({
      ...ledgerBalanceFixture,
      partnerId: request.partnerId,
    }));
  jest.mocked(requestProgramPreferences).mockReset().mockResolvedValue(programPreferencesFixture());
});
afterEach(() => {
  cleanup();
  client.clear();
  tokenStore.set(null);
  clearAdminReadDenial();
  clearProgramPreferencesDenial();
});

it("keys every actual partner and limit under actor VIEW epoch, never bearer or inferred actor ownership", async () => {
  const { result } = renderHook(
    () => ({
      ...useReads(),
      other: useAdminFinancialLedger(OTHER, 1),
      small: useAdminFinancialLedger(PARTNER, 1),
    }),
    { wrapper: Wrapper },
  );
  await waitFor(() => {
    expect(result.current.ledger.data).toBeDefined();
    expect(result.current.balance.data).toBeDefined();
    expect(result.current.other.data).toBeDefined();
    expect(result.current.small.data).toBeDefined();
  });
  const base = [...partnersKeys.adminRead(USER_A), "session", result.current.ledger.session.epoch];
  const keys = client
    .getQueryCache()
    .getAll()
    .map((query) => query.queryKey);
  expect(keys).toContainEqual([...base, "financial-ledger", PARTNER, 20]);
  expect(keys).toContainEqual([...base, "financial-ledger", PARTNER, 1]);
  expect(keys).toContainEqual([...base, "financial-ledger", OTHER, 1]);
  expect(keys).toContainEqual([...base, "financial-balance", PARTNER]);
  expect(JSON.stringify(keys)).not.toContain("private-A");
  expect(requestAdminFinancialLedger).toHaveBeenCalledWith({
    accessToken: "private-A",
    signal: expect.any(AbortSignal),
    partnerId: OTHER,
    cursor: null,
    limit: 1,
  });
  expect(requestAdminFinancialBalance).toHaveBeenCalledWith({
    accessToken: "private-A",
    signal: expect.any(AbortSignal),
    partnerId: PARTNER,
  });
  expect(PARTNER).not.toBe(USER_A);
});

it("follows only the recorded scoped cursor and stops at the final page", async () => {
  const second = { ...ledgerEntryFixture, id: OTHER };
  jest
    .mocked(requestAdminFinancialLedger)
    .mockResolvedValueOnce(
      ledgerPageFixture(undefined, { limit: 1, hasMore: true, nextCursor: "scoped_next" }),
    )
    .mockResolvedValueOnce(ledgerPageFixture([second], { limit: 1 }));
  const { result } = renderHook(() => useAdminFinancialLedger(PARTNER, 1), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.hasNextPage).toBe(true));
  await act(async () => {
    await result.current.fetchNextPage();
  });
  await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
  expect(result.current.data?.pageParams).toEqual([null, "scoped_next"]);
  expect(requestAdminFinancialLedger).toHaveBeenLastCalledWith({
    accessToken: "private-A",
    signal: expect.any(AbortSignal),
    partnerId: PARTNER,
    cursor: "scoped_next",
    limit: 1,
  });
  expect(result.current.hasNextPage).toBe(false);
});

it.each([null, "", "../me", "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"])(
  "invalid partner %p never dispatches, including explicit refetch",
  async (partnerId) => {
    const { result } = renderHook(() => useReads(partnerId), { wrapper: Wrapper });
    expect(result.current.ledger.session.enabled).toBe(false);
    await act(async () => {
      await result.current.ledger.refetch();
      await result.current.balance.refetch();
    });
    expect(requestAdminFinancialLedger).not.toHaveBeenCalled();
    expect(requestAdminFinancialBalance).not.toHaveBeenCalled();
  },
);

it.each([null, { user: { id: USER_A, permissions: [] }, accessToken: "private-A" }])(
  "no current VIEW means no administrative HTTP: %#",
  async (auth) => {
    mockAuth = auth;
    const { result } = renderHook(() => useReads(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.ledger.refetch();
      await result.current.balance.refetch();
    });
    expect(requestAdminFinancialLedger).not.toHaveBeenCalled();
    expect(requestAdminFinancialBalance).not.toHaveBeenCalled();
    expect(result.current.ledger.data).toBeUndefined();
    expect(result.current.balance.data).toBeUndefined();
  },
);

it.each([401, 403])(
  "HTTP%s purges all partner/limit/Billing VIEW variants while a VIEW403 preserves own preferences",
  async (status) => {
    const { result } = renderHook(
      () => ({
        ...useReads(),
        other: useAdminFinancialLedger(OTHER, 1),
        preferences: useProgramPreferences(),
      }),
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      expect(result.current.ledger.data).toBeDefined();
      expect(result.current.balance.data).toBeDefined();
      expect(result.current.other.data).toBeDefined();
      expect(result.current.preferences.data).toBeDefined();
    });
    act(() => {
      client.setQueryData([...partnersKeys.adminRead(USER_A), "billing-evidence", "old"], {
        private: "billing",
      });
      client.setQueryData(
        [
          ...partnersKeys.adminRead(USER_A),
          "session",
          result.current.ledger.session.epoch,
          "financial-ledger",
          OTHER,
          73,
        ],
        { private: "other limit" },
      );
    });
    const denied = buildAxiosError(status);
    jest.mocked(requestAdminFinancialBalance).mockRejectedValueOnce(denied);
    await act(async () => {
      await result.current.balance.refetch();
    });
    await waitFor(() => expect(result.current.ledger.session.denied).toBe(denied));
    for (const query of [result.current.ledger, result.current.balance, result.current.other]) {
      expect(query.data).toBeUndefined();
      expect(query.error).toBe(denied);
    }
    expect(
      client
        .getQueriesData({ queryKey: partnersKeys.adminRead(USER_A) })
        .every(([, data]) => data === undefined),
    ).toBe(true);
    if (status === 403) {
      expect(result.current.preferences.data).toEqual(programPreferencesFixture());
      expect(result.current.preferences.session.enabled).toBe(true);
    } else {
      expect(result.current.preferences.data).toBeUndefined();
      expect(result.current.preferences.session.enabled).toBe(false);
    }
  },
);

it("switching actual partner scope aborts old requests and ignores a late old-partner denial", async () => {
  const pending = deferred<FinancialLedgerPage>();
  jest.mocked(requestAdminFinancialLedger).mockReturnValueOnce(pending.promise);
  const { result, rerender } = renderHook(({ partnerId }) => useReads(partnerId), {
    wrapper: Wrapper,
    initialProps: { partnerId: PARTNER },
  });
  await waitFor(() => expect(requestAdminFinancialLedger).toHaveBeenCalledTimes(1));
  const oldSignal = jest.mocked(requestAdminFinancialLedger).mock.calls[0][0].signal;
  rerender({ partnerId: OTHER });
  expect(oldSignal?.aborted).toBe(true);
  expect(result.current.ledger.data).toBeUndefined();
  expect(result.current.balance.data).toBeUndefined();
  await act(async () => {
    pending.reject(buildAxiosError(403));
  });
  await waitFor(() => expect(result.current.balance.data?.partnerId).toBe(OTHER));
  expect(result.current.ledger.data?.pages[0].items[0].partnerId).toBe(OTHER);
  expect(result.current.ledger.session.denied).toBeNull();
});

it.each([USER_A, USER_B])("actor/token renewal isolates pending money for %s", async (nextUser) => {
  const pendingLedger = deferred<FinancialLedgerPage>();
  const pendingBalance = deferred<FinancialLedgerBalance>();
  jest.mocked(requestAdminFinancialLedger).mockReturnValueOnce(pendingLedger.promise);
  jest.mocked(requestAdminFinancialBalance).mockReturnValueOnce(pendingBalance.promise);
  const { result, rerender } = renderHook(() => useReads(), { wrapper: Wrapper });
  await waitFor(() => {
    expect(requestAdminFinancialLedger).toHaveBeenCalledTimes(1);
    expect(requestAdminFinancialBalance).toHaveBeenCalledTimes(1);
  });
  const oldEpoch = result.current.ledger.session.epoch;
  const oldSignal = jest.mocked(requestAdminFinancialLedger).mock.calls[0][0].signal;
  mockAuth = { user: { id: nextUser, permissions: ["PARTNERS_VIEW"] }, accessToken: "private-B" };
  tokenStore.set("private-B");
  rerender();
  expect(oldSignal?.aborted).toBe(true);
  expect(result.current.ledger.session.epoch).not.toBe(oldEpoch);
  expect(result.current.ledger.data).toBeUndefined();
  expect(result.current.balance.data).toBeUndefined();
  await act(async () => {
    pendingLedger.reject(buildAxiosError(403));
    pendingBalance.resolve({
      ...ledgerBalanceFixture,
      postedLedgerBalance: "99999999999999999999.99999999",
    });
  });
  await waitFor(() => expect(result.current.balance.data?.postedLedgerBalance).toBe("34.50"));
  expect(result.current.ledger.session.denied).toBeNull();
  expect(requestAdminFinancialBalance).toHaveBeenLastCalledWith({
    accessToken: "private-B",
    signal: expect.any(AbortSignal),
    partnerId: PARTNER,
  });
});

it("shared current 401 aborts pending ledger and balance and cannot revive late data", async () => {
  const pendingLedger = deferred<FinancialLedgerPage>();
  const pendingBalance = deferred<FinancialLedgerBalance>();
  jest.mocked(requestAdminFinancialLedger).mockReturnValueOnce(pendingLedger.promise);
  jest.mocked(requestAdminFinancialBalance).mockReturnValueOnce(pendingBalance.promise);
  const { result } = renderHook(() => useReads(), { wrapper: Wrapper });
  await waitFor(() => {
    expect(requestAdminFinancialLedger).toHaveBeenCalledTimes(1);
    expect(requestAdminFinancialBalance).toHaveBeenCalledTimes(1);
  });
  const signal = jest.mocked(requestAdminFinancialLedger).mock.calls[0][0].signal;
  const balanceSignal = jest.mocked(requestAdminFinancialBalance).mock.calls[0][0].signal;
  const denied = buildAxiosError(401);
  act(() => denyAdminReadSession(USER_A, "private-A", denied));
  await waitFor(() => expect(signal?.aborted && balanceSignal?.aborted).toBe(true));
  await act(async () => {
    pendingLedger.resolve(ledgerPageFixture());
    pendingBalance.resolve(ledgerBalanceFixture);
  });
  expect(result.current.ledger.error).toBe(denied);
  expect(result.current.balance.error).toBe(denied);
  expect(result.current.ledger.data).toBeUndefined();
  expect(result.current.balance.data).toBeUndefined();
  expect(
    client
      .getQueriesData({ queryKey: partnersKeys.adminRead(USER_A) })
      .every(([, data]) => data === undefined),
  ).toBe(true);
});

it("stale tokenStore prevents both dispatched requests without changing auth ownership", async () => {
  tokenStore.set("private-B");
  const { result } = renderHook(() => useReads(), { wrapper: Wrapper });
  await act(async () => {
    await result.current.ledger.refetch();
    await result.current.balance.refetch();
  });
  expect(requestAdminFinancialLedger).not.toHaveBeenCalled();
  expect(requestAdminFinancialBalance).not.toHaveBeenCalled();
});

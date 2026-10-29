import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { tokenStore } from "@/lib/tokenStore";
import {
  requestOwnCommissionEvaluations,
  requestOwnCommissionItems,
} from "../../api/commission-read.api";
import {
  requestOwnFinancialBalance,
  requestOwnFinancialLedger,
} from "../../api/financial-ledger.api";
import { requestProgramPreferences } from "../../api/program-preferences.api";
import type { FinancialLedgerBalance, FinancialLedgerPage } from "../../models/financial-ledger";
import { buildAxiosError } from "../../test-utils/axios-error";
import {
  commissionEvaluationFixture,
  commissionItemFixture,
  commissionReadPageFixture,
} from "../../test-utils/commission-read.fixture";
import {
  ledgerBalanceFixture,
  ledgerEntryFixture,
  ledgerPageFixture,
} from "../../test-utils/financial-ledger.fixture";
import { programPreferencesFixture } from "../../test-utils/program-preferences.fixture";
import {
  adminReadDenialFor,
  clearAdminReadDenial,
  denyAdminReadSession,
} from "../../utils/admin-read-session-state";
import { clearCommissionReadDenial } from "../../utils/commission-read-session-state";
import {
  clearProgramPreferencesDenial,
  getProgramPreferencesDenial,
} from "../../utils/program-preferences-session-state";
import { useOwnCommissionEvaluations, useOwnCommissionItems } from "../use-own-commission-read";
import { useOwnFinancialBalance, useOwnFinancialLedger } from "../use-own-financial-ledger";
import { useProgramPreferences } from "../use-program-preferences";

let mockAuth: { user: { id: string }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("../../api/financial-ledger.api", () => ({
  requestOwnFinancialLedger: jest.fn(),
  requestOwnFinancialBalance: jest.fn(),
}));
jest.mock("../../api/commission-read.api", () => ({
  requestOwnCommissionItems: jest.fn(),
  requestOwnCommissionEvaluations: jest.fn(),
}));
jest.mock("../../api/program-preferences.api", () => ({ requestProgramPreferences: jest.fn() }));

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
let client: QueryClient;
function wrapper() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
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
function useOwnReads() {
  return { ledger: useOwnFinancialLedger(), balance: useOwnFinancialBalance() };
}
beforeEach(() => {
  clearAdminReadDenial();
  clearCommissionReadDenial();
  clearProgramPreferencesDenial();
  mockAuth = { user: { id: USER_A }, accessToken: "private-A" };
  tokenStore.set(mockAuth.accessToken);
  jest.mocked(requestOwnFinancialLedger).mockReset().mockResolvedValue(ledgerPageFixture());
  jest.mocked(requestOwnFinancialBalance).mockReset().mockResolvedValue(ledgerBalanceFixture);
  jest
    .mocked(requestOwnCommissionItems)
    .mockReset()
    .mockResolvedValue(commissionReadPageFixture([commissionItemFixture]));
  jest
    .mocked(requestOwnCommissionEvaluations)
    .mockReset()
    .mockResolvedValue(commissionReadPageFixture([commissionEvaluationFixture]));
  jest.mocked(requestProgramPreferences).mockReset().mockResolvedValue(programPreferencesFixture());
});
afterEach(() => {
  cleanup();
  client?.clear();
  tokenStore.set(null);
  clearCommissionReadDenial();
  clearAdminReadDenial();
  clearProgramPreferencesDenial();
});

it("isolates ledger, balance and limit keys in the real commission-read family with a captured bearer", async () => {
  const { result } = renderHook(() => ({ ...useOwnReads(), small: useOwnFinancialLedger(1) }), {
    wrapper: wrapper(),
  });
  await waitFor(() => expect(result.current.ledger.data?.pages[0]).toEqual(ledgerPageFixture()));
  await waitFor(() => expect(result.current.balance.data).toEqual(ledgerBalanceFixture));
  expect(requestOwnFinancialLedger).toHaveBeenCalledWith({
    accessToken: "private-A",
    signal: expect.any(AbortSignal),
    cursor: null,
    limit: 20,
  });
  expect(requestOwnFinancialLedger).toHaveBeenCalledWith({
    accessToken: "private-A",
    signal: expect.any(AbortSignal),
    cursor: null,
    limit: 1,
  });
  expect(requestOwnFinancialBalance).toHaveBeenCalledWith({
    accessToken: "private-A",
    signal: expect.any(AbortSignal),
  });
  const keys = client
    .getQueryCache()
    .getAll()
    .map((query) => query.queryKey);
  const family = result.current.ledger.session.queryKey;
  expect(keys).toContainEqual([...family, "ledger", 20]);
  expect(keys).toContainEqual([...family, "ledger", 1]);
  expect(keys).toContainEqual([...family, "ledger-balance"]);
  expect(family).toEqual(["partners", "own-commission-evidence", USER_A, expect.any(Number)]);
  expect(JSON.stringify(keys)).not.toContain("private-A");
  expect(result.current.balance.session.enabled).toBe(true);
});

it("uses only the recorded next cursor, retains the first page and stops at the final page", async () => {
  const second = { ...ledgerEntryFixture, id: "99999999-9999-4999-8999-999999999999" };
  jest
    .mocked(requestOwnFinancialLedger)
    .mockResolvedValueOnce(
      ledgerPageFixture([ledgerEntryFixture], {
        limit: 1,
        hasMore: true,
        nextCursor: "recorded_next_cursor",
      }),
    )
    .mockResolvedValueOnce(ledgerPageFixture([second], { limit: 1 }));
  const { result } = renderHook(() => useOwnFinancialLedger(1), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.hasNextPage).toBe(true));
  await act(async () => {
    await result.current.fetchNextPage();
  });
  await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
  expect(result.current.data?.pageParams).toEqual([null, "recorded_next_cursor"]);
  expect(result.current.data?.pages.flatMap((page) => page.items)).toEqual([
    ledgerEntryFixture,
    second,
  ]);
  expect(requestOwnFinancialLedger).toHaveBeenLastCalledWith({
    accessToken: "private-A",
    signal: expect.any(AbortSignal),
    cursor: "recorded_next_cursor",
    limit: 1,
  });
  expect(result.current.hasNextPage).toBe(false);
  expect(requestOwnFinancialLedger).toHaveBeenCalledTimes(2);
});

it.each(["ledger", "balance"] as const)(
  "a current %s 403 purges every commission read endpoint and limit without denying own preferences",
  async (endpoint) => {
    const { result } = renderHook(
      () => ({
        ...useOwnReads(),
        items: useOwnCommissionItems(),
        evaluations: useOwnCommissionEvaluations(),
        preferences: useProgramPreferences(),
      }),
      { wrapper: wrapper() },
    );
    await waitFor(() => {
      expect(result.current.ledger.data).toBeDefined();
      expect(result.current.balance.data).toBeDefined();
      expect(result.current.items.data).toBeDefined();
      expect(result.current.evaluations.data).toBeDefined();
      expect(result.current.preferences.data).toBeDefined();
    });
    const family = result.current.ledger.session.queryKey;
    act(() => {
      client.setQueryData([...family, "ledger", 73], { pages: [ledgerPageFixture()] });
      client.setQueryData([...family, "items", 73], { pages: [commissionReadPageFixture()] });
    });
    const denied = buildAxiosError(403);
    if (endpoint === "ledger") jest.mocked(requestOwnFinancialLedger).mockRejectedValueOnce(denied);
    else jest.mocked(requestOwnFinancialBalance).mockRejectedValueOnce(denied);
    await act(async () => {
      await result.current[endpoint].refetch();
    });
    await waitFor(() => expect(result.current.ledger.session.denied).toBe(denied));
    for (const read of [
      result.current.ledger,
      result.current.balance,
      result.current.items,
      result.current.evaluations,
    ]) {
      expect(read.data).toBeUndefined();
      expect(read.session.enabled).toBe(false);
      expect(read.error).toBe(denied);
    }
    expect(client.getQueriesData({ queryKey: family }).some(([, data]) => data !== undefined)).toBe(
      false,
    );
    expect(result.current.preferences.data).toEqual(programPreferencesFixture());
    expect(result.current.preferences.session.enabled).toBe(true);
    expect(getProgramPreferencesDenial(USER_A, result.current.ledger.session.epoch)).toBeNull();
    expect(adminReadDenialFor(USER_A, "private-A")).toBeNull();
  },
);

it("a shared current 401 aborts both pending transports and cannot revive their late responses", async () => {
  const ledgerPending = deferred<FinancialLedgerPage>();
  const balancePending = deferred<FinancialLedgerBalance>();
  jest.mocked(requestOwnFinancialLedger).mockReturnValueOnce(ledgerPending.promise);
  jest.mocked(requestOwnFinancialBalance).mockReturnValueOnce(balancePending.promise);
  const { result } = renderHook(useOwnReads, { wrapper: wrapper() });
  await waitFor(() => {
    expect(requestOwnFinancialLedger).toHaveBeenCalledTimes(1);
    expect(requestOwnFinancialBalance).toHaveBeenCalledTimes(1);
  });
  const ledgerSignal = jest.mocked(requestOwnFinancialLedger).mock.calls[0][0].signal;
  const balanceSignal = jest.mocked(requestOwnFinancialBalance).mock.calls[0][0].signal;
  const denied = buildAxiosError(401);
  act(() => denyAdminReadSession(USER_A, "private-A", denied));
  await waitFor(() => {
    expect(result.current.ledger.session.denied).toBe(denied);
    expect(ledgerSignal?.aborted).toBe(true);
    expect(balanceSignal?.aborted).toBe(true);
  });
  await act(async () => {
    ledgerPending.resolve(ledgerPageFixture());
    balancePending.resolve(ledgerBalanceFixture);
  });
  expect(result.current.ledger.data).toBeUndefined();
  expect(result.current.balance.data).toBeUndefined();
  expect(result.current.ledger.error).toBe(denied);
  expect(result.current.balance.error).toBe(denied);
  expect(
    client
      .getQueriesData({ queryKey: result.current.ledger.session.queryKey })
      .some(([, data]) => data !== undefined),
  ).toBe(false);
  await act(async () => {
    await result.current.ledger.refetch();
    await result.current.balance.refetch();
  });
  expect(requestOwnFinancialLedger).toHaveBeenCalledTimes(1);
  expect(requestOwnFinancialBalance).toHaveBeenCalledTimes(1);
});

it.each([
  { userId: USER_B, description: "different account" },
  { userId: USER_A, description: "renewed bearer" },
])(
  "isolates a $description and ignores an old late 403 without poisoning the new epoch",
  async ({ userId }) => {
    const oldLedger = deferred<FinancialLedgerPage>();
    const oldBalance = deferred<FinancialLedgerBalance>();
    jest.mocked(requestOwnFinancialLedger).mockReturnValueOnce(oldLedger.promise);
    jest.mocked(requestOwnFinancialBalance).mockReturnValueOnce(oldBalance.promise);
    const { result, rerender } = renderHook(useOwnReads, { wrapper: wrapper() });
    await waitFor(() => {
      expect(requestOwnFinancialLedger).toHaveBeenCalledTimes(1);
      expect(requestOwnFinancialBalance).toHaveBeenCalledTimes(1);
    });
    const oldKey = result.current.ledger.session.queryKey;
    const ledgerSignal = jest.mocked(requestOwnFinancialLedger).mock.calls[0][0].signal;
    const balanceSignal = jest.mocked(requestOwnFinancialBalance).mock.calls[0][0].signal;
    const nextBalance = { ...ledgerBalanceFixture, postedLedgerBalance: "-9.25000000" };
    jest.mocked(requestOwnFinancialLedger).mockResolvedValueOnce(ledgerPageFixture([]));
    jest.mocked(requestOwnFinancialBalance).mockResolvedValueOnce(nextBalance);
    mockAuth = { user: { id: userId }, accessToken: "private-B" };
    tokenStore.set(mockAuth.accessToken);
    rerender();
    expect(ledgerSignal?.aborted).toBe(true);
    expect(balanceSignal?.aborted).toBe(true);
    expect(result.current.ledger.session.queryKey).not.toEqual(oldKey);
    expect(result.current.ledger.data).toBeUndefined();
    expect(result.current.balance.data).toBeUndefined();
    await act(async () => {
      oldLedger.reject(buildAxiosError(403));
      oldBalance.resolve(ledgerBalanceFixture);
    });
    await waitFor(() => {
      expect(result.current.ledger.data?.pages[0].items).toEqual([]);
      expect(result.current.balance.data).toEqual(nextBalance);
    });
    expect(result.current.ledger.session.denied).toBeNull();
    expect(result.current.balance.session.enabled).toBe(true);
    expect(requestOwnFinancialLedger).toHaveBeenLastCalledWith({
      accessToken: "private-B",
      signal: expect.any(AbortSignal),
      cursor: null,
      limit: 20,
    });
    expect(requestOwnFinancialBalance).toHaveBeenLastCalledWith({
      accessToken: "private-B",
      signal: expect.any(AbortSignal),
    });
    expect(client.getQueryData([...oldKey, "ledger", 20])).toBeUndefined();
    expect(client.getQueryData([...oldKey, "ledger-balance"])).toBeUndefined();
  },
);

it("does not dispatch with a stale captured bearer even when an explicit refetch is requested", async () => {
  tokenStore.set("private-B");
  const { result } = renderHook(useOwnReads, { wrapper: wrapper() });
  await act(async () => {
    await result.current.ledger.refetch();
    await result.current.balance.refetch();
  });
  expect(requestOwnFinancialLedger).not.toHaveBeenCalled();
  expect(requestOwnFinancialBalance).not.toHaveBeenCalled();
  expect(result.current.ledger.data).toBeUndefined();
  expect(result.current.balance.data).toBeUndefined();
});

it("anonymous sessions never dispatch either endpoint, including explicit refetch", async () => {
  mockAuth = null;
  tokenStore.set(null);
  const { result } = renderHook(useOwnReads, { wrapper: wrapper() });
  expect(result.current.ledger.session.enabled).toBe(false);
  expect(result.current.balance.session.enabled).toBe(false);
  await act(async () => {
    await result.current.ledger.refetch();
    await result.current.balance.refetch();
  });
  expect(requestOwnFinancialLedger).not.toHaveBeenCalled();
  expect(requestOwnFinancialBalance).not.toHaveBeenCalled();
});

it("unmount aborts both signals before late money can populate cache", async () => {
  const ledgerPending = deferred<FinancialLedgerPage>();
  const balancePending = deferred<FinancialLedgerBalance>();
  jest.mocked(requestOwnFinancialLedger).mockReturnValueOnce(ledgerPending.promise);
  jest.mocked(requestOwnFinancialBalance).mockReturnValueOnce(balancePending.promise);
  const { unmount } = renderHook(useOwnReads, { wrapper: wrapper() });
  await waitFor(() => {
    expect(requestOwnFinancialLedger).toHaveBeenCalledTimes(1);
    expect(requestOwnFinancialBalance).toHaveBeenCalledTimes(1);
  });
  const ledgerSignal = jest.mocked(requestOwnFinancialLedger).mock.calls[0][0].signal;
  const balanceSignal = jest.mocked(requestOwnFinancialBalance).mock.calls[0][0].signal;
  unmount();
  expect(ledgerSignal?.aborted).toBe(true);
  expect(balanceSignal?.aborted).toBe(true);
  await act(async () => {
    ledgerPending.resolve(ledgerPageFixture());
    balancePending.resolve(ledgerBalanceFixture);
  });
  expect(
    client
      .getQueryCache()
      .getAll()
      .some((query) => query.state.data !== undefined),
  ).toBe(false);
});

it("transport errors do not fabricate empty ledger or zero balance, and an explicit retry returns exact data", async () => {
  jest.mocked(requestOwnFinancialLedger).mockRejectedValueOnce(buildAxiosError(503));
  jest.mocked(requestOwnFinancialBalance).mockRejectedValueOnce(buildAxiosError(503));
  const { result } = renderHook(useOwnReads, { wrapper: wrapper() });
  await waitFor(() => {
    expect(result.current.ledger.isError).toBe(true);
    expect(result.current.balance.isError).toBe(true);
  });
  expect(result.current.ledger.data).toBeUndefined();
  expect(result.current.balance.data).toBeUndefined();
  expect(result.current.ledger.session.denied).toBeNull();
  await act(async () => {
    await result.current.ledger.refetch();
    await result.current.balance.refetch();
  });
  await waitFor(() => {
    expect(result.current.ledger.data?.pages[0]).toEqual(ledgerPageFixture());
    expect(result.current.balance.data).toEqual(ledgerBalanceFixture);
  });
});

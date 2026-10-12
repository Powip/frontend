import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { tokenStore } from "@/lib/tokenStore";
import {
  requestOwnCommissionEvaluations,
  requestOwnCommissionItems,
} from "../../api/commission-read.api";
import { requestProgramPreferences } from "../../api/program-preferences.api";
import type { CommissionCalculationItem, CommissionItemsPage } from "../../models/commission-read";
import { buildAxiosError } from "../../test-utils/axios-error";
import {
  commissionEvaluationFixture,
  commissionItemFixture,
  commissionReadPageFixture,
} from "../../test-utils/commission-read.fixture";
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
import { useProgramPreferences } from "../use-program-preferences";

let mockAuth: { user: { id: string }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
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
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
beforeEach(() => {
  clearAdminReadDenial();
  clearCommissionReadDenial();
  clearProgramPreferencesDenial();
  mockAuth = { user: { id: USER_A }, accessToken: "private-A" };
  tokenStore.set(mockAuth.accessToken);
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

it("separates items/evaluations/limit keys and captures the same bearer without old financial cache", async () => {
  const { result } = renderHook(
    () => ({
      items: useOwnCommissionItems(),
      evaluations: useOwnCommissionEvaluations(),
      small: useOwnCommissionItems(1),
    }),
    { wrapper: wrapper() },
  );
  client.setQueryData(["partners", "commissions"], [{ businessName: "OLD MOCK MUST NOT SHOW" }]);
  await waitFor(() =>
    expect(result.current.items.data?.pages[0].items).toEqual([commissionItemFixture]),
  );
  await waitFor(() =>
    expect(result.current.evaluations.data?.pages[0].items).toEqual([commissionEvaluationFixture]),
  );
  expect(requestOwnCommissionItems).toHaveBeenCalledWith({
    accessToken: "private-A",
    signal: expect.any(AbortSignal),
    cursor: null,
    limit: 20,
  });
  expect(requestOwnCommissionItems).toHaveBeenCalledWith({
    accessToken: "private-A",
    signal: expect.any(AbortSignal),
    cursor: null,
    limit: 1,
  });
  const keys = client
    .getQueryCache()
    .getAll()
    .map((query) => query.queryKey);
  expect(keys).toContainEqual([...result.current.items.session.queryKey, "items", 20]);
  expect(keys).toContainEqual([...result.current.items.session.queryKey, "evaluations", 20]);
  expect(JSON.stringify(keys)).not.toContain("private-A");
});
it("follows only its recorded next cursor and stops on the final page", async () => {
  const second: CommissionCalculationItem = {
    ...commissionItemFixture,
    id: "99999999-9999-4999-8999-999999999999",
  };
  jest
    .mocked(requestOwnCommissionItems)
    .mockResolvedValueOnce(
      commissionReadPageFixture([commissionItemFixture], {
        limit: 1,
        hasMore: true,
        nextCursor: "opaque_next",
      }),
    )
    .mockResolvedValueOnce(commissionReadPageFixture([second], { limit: 1 }));
  const { result } = renderHook(() => useOwnCommissionItems(1), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.hasNextPage).toBe(true));
  await act(async () => {
    await result.current.fetchNextPage();
  });
  await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
  expect(requestOwnCommissionItems).toHaveBeenLastCalledWith({
    accessToken: "private-A",
    signal: expect.any(AbortSignal),
    cursor: "opaque_next",
    limit: 1,
  });
  expect(result.current.hasNextPage).toBe(false);
});
it("a withdrawn COMMISSIONS_READ purges its two endpoints but leaves own preferences allowed", async () => {
  const { result } = renderHook(
    () => ({
      items: useOwnCommissionItems(),
      evaluations: useOwnCommissionEvaluations(),
      preferences: useProgramPreferences(),
    }),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(result.current.preferences.data).toBeDefined());
  await waitFor(() => expect(result.current.items.data).toBeDefined());
  const denied = buildAxiosError(403);
  jest.mocked(requestOwnCommissionEvaluations).mockRejectedValueOnce(denied);
  await act(async () => {
    await result.current.evaluations.refetch();
  });
  await waitFor(() => expect(result.current.items.session.denied).toBe(denied));
  expect(result.current.items.data).toBeUndefined();
  expect(result.current.evaluations.data).toBeUndefined();
  expect(result.current.preferences.data).toBeDefined();
  expect(result.current.preferences.session.enabled).toBe(true);
  expect(getProgramPreferencesDenial(USER_A, result.current.items.session.epoch)).toBeNull();
  expect(adminReadDenialFor(USER_A, "private-A")).toBeNull();
  expect(
    client
      .getQueryCache()
      .getAll()
      .filter((query) => query.queryKey[1] === "own-commission-evidence")
      .some((query) => query.state.data !== undefined),
  ).toBe(false);
});
it("renewed user/bearer aborts the old financial read and cannot render its late page", async () => {
  const pending = deferred<CommissionItemsPage>();
  jest.mocked(requestOwnCommissionItems).mockReturnValueOnce(pending.promise);
  const { result, rerender } = renderHook(() => useOwnCommissionItems(), { wrapper: wrapper() });
  await waitFor(() => expect(requestOwnCommissionItems).toHaveBeenCalledTimes(1));
  const signal = jest.mocked(requestOwnCommissionItems).mock.calls[0][0].signal;
  mockAuth = { user: { id: USER_B }, accessToken: "private-B" };
  tokenStore.set(mockAuth.accessToken);
  jest.mocked(requestOwnCommissionItems).mockResolvedValueOnce(commissionReadPageFixture());
  rerender();
  expect(signal?.aborted).toBe(true);
  expect(result.current.data).toBeUndefined();
  await act(async () => {
    pending.resolve(commissionReadPageFixture([commissionItemFixture]));
  });
  await waitFor(() => expect(result.current.data?.pages[0].items).toEqual([]));
  expect(requestOwnCommissionItems).toHaveBeenLastCalledWith({
    accessToken: "private-B",
    signal: expect.any(AbortSignal),
    cursor: null,
    limit: 20,
  });
});
it("shared current 401 removes cached financial evidence", async () => {
  const { result } = renderHook(() => useOwnCommissionItems(), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.data).toBeDefined());
  const denied = buildAxiosError(401);
  await act(async () => {
    denyAdminReadSession(USER_A, "private-A", denied);
  });
  await waitFor(() => expect(result.current.session.denied).toBe(denied));
  expect(result.current.data).toBeUndefined();
  expect(
    client
      .getQueryCache()
      .getAll()
      .some((query) => query.state.data !== undefined),
  ).toBe(false);
});
it("anonymous sessions never dispatch even on explicit refetch", async () => {
  mockAuth = null;
  tokenStore.set(null);
  const { result } = renderHook(() => useOwnCommissionItems(), { wrapper: wrapper() });
  expect(result.current.session.enabled).toBe(false);
  await act(async () => {
    await result.current.refetch();
  });
  expect(requestOwnCommissionItems).not.toHaveBeenCalled();
  expect(result.current.data).toBeUndefined();
});

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import QueryProvider from "@/components/providers/QueryProvider";
import { tokenStore } from "@/lib/tokenStore";
import { partnersKeys } from "../../keys/partners.keys";
import { getAdminDashboardSummary } from "../../services/get-admin-dashboard-summary";
import { getAdminPartner } from "../../services/get-admin-partner";
import { getAdminPartnerActivity } from "../../services/get-admin-partner-activity";
import { getAdminPartnerReferrals } from "../../services/get-admin-partner-referrals";
import { getAdminPartners } from "../../services/get-admin-partners";
import {
  ADMIN_PARTNER_ID,
  ADMIN_USER_A,
  ADMIN_USER_B,
  buildAdminActivity,
  buildAdminPage,
  buildAdminPartner,
  buildAdminReferral,
  buildAdminSummary,
} from "../../test-utils/admin-partners.fixture";
import { buildAxiosError } from "../../test-utils/axios-error";
import { clearAdminReadDenial } from "../../utils/admin-read-session-state";
import { useAdminDashboardSummary } from "../use-admin-dashboard-summary";
import { useAdminPartner } from "../use-admin-partner";
import { useAdminPartnerActivity } from "../use-admin-partner-activity";
import { useAdminPartnerReferrals } from "../use-admin-partner-referrals";
import { useAdminPartners } from "../use-admin-partners";
import { useAdminReadAccess } from "../use-admin-read-session";

let mockAuth: {
  user: { id: string; permissions: string[]; email?: string };
  accessToken: string;
} | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@tanstack/react-query-devtools", () => ({ ReactQueryDevtools: () => null }));
jest.mock("../../services/get-admin-partners", () => ({ getAdminPartners: jest.fn() }));
jest.mock("../../services/get-admin-partner", () => ({ getAdminPartner: jest.fn() }));
jest.mock("../../services/get-admin-partner-referrals", () => ({
  getAdminPartnerReferrals: jest.fn(),
}));
jest.mock("../../services/get-admin-partner-activity", () => ({
  getAdminPartnerActivity: jest.fn(),
}));
jest.mock("../../services/get-admin-dashboard-summary", () => ({
  getAdminDashboardSummary: jest.fn(),
}));
const services = [
  getAdminPartners,
  getAdminPartner,
  getAdminPartnerReferrals,
  getAdminPartnerActivity,
  getAdminDashboardSummary,
];
let client: QueryClient;
function Probe() {
  client = useQueryClient();
  return null;
}
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <Probe />
      {children}
    </QueryProvider>
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

beforeEach(() => {
  clearAdminReadDenial();
  mockAuth = { user: { id: ADMIN_USER_A, permissions: ["PARTNERS_VIEW"] }, accessToken: "A" };
  tokenStore.set("A");
  services.forEach((service) => {
    jest.mocked(service).mockReset();
  });
});
afterEach(() => {
  cleanup();
  client?.clear();
  tokenStore.set(null);
  clearAdminReadDenial();
});

it("requests each read using the initiating identity, bearer and signal", async () => {
  jest.mocked(getAdminPartners).mockResolvedValue(buildAdminPage());
  jest.mocked(getAdminPartner).mockResolvedValue(buildAdminPartner());
  jest
    .mocked(getAdminPartnerReferrals)
    .mockResolvedValue({ ...buildAdminPage(), items: [buildAdminReferral()] });
  jest
    .mocked(getAdminPartnerActivity)
    .mockResolvedValue({ ...buildAdminPage(), items: [buildAdminActivity()] });
  jest.mocked(getAdminDashboardSummary).mockResolvedValue(buildAdminSummary());
  const { result } = renderHook(
    () => ({
      list: useAdminPartners("SUSPENDED", 5),
      detail: useAdminPartner(ADMIN_PARTNER_ID),
      referrals: useAdminPartnerReferrals(ADMIN_PARTNER_ID),
      activity: useAdminPartnerActivity(ADMIN_PARTNER_ID),
      dashboard: useAdminDashboardSummary(),
    }),
    { wrapper: Wrapper },
  );
  await waitFor(() =>
    expect(Object.values(result.current).every((query) => query.isSuccess)).toBe(true),
  );
  for (const service of services)
    expect(service).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "A", signal: expect.any(AbortSignal) }),
    );
  expect(getAdminPartners).toHaveBeenCalledWith(
    expect.objectContaining({ status: "SUSPENDED", limit: 5, cursor: null }),
  );
  expect(
    JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey),
    ),
  ).not.toContain('"A"');
});

it("accumulates list, referral and activity pages using the opaque cursor", async () => {
  jest
    .mocked(getAdminPartners)
    .mockResolvedValueOnce({ ...buildAdminPage(), nextCursor: "list-next", hasMore: true })
    .mockResolvedValueOnce(buildAdminPage(buildAdminPartner({ id: ADMIN_USER_B })));
  jest
    .mocked(getAdminPartnerReferrals)
    .mockResolvedValueOnce({
      ...buildAdminPage(),
      items: [buildAdminReferral()],
      nextCursor: "ref-next",
      hasMore: true,
    })
    .mockResolvedValueOnce({ ...buildAdminPage(), items: [] });
  jest
    .mocked(getAdminPartnerActivity)
    .mockResolvedValueOnce({
      ...buildAdminPage(),
      items: [buildAdminActivity()],
      nextCursor: "audit-next",
      hasMore: true,
    })
    .mockResolvedValueOnce({ ...buildAdminPage(), items: [] });
  const { result } = renderHook(
    () => ({
      list: useAdminPartners(),
      referrals: useAdminPartnerReferrals(ADMIN_PARTNER_ID),
      activity: useAdminPartnerActivity(ADMIN_PARTNER_ID),
    }),
    { wrapper: Wrapper },
  );
  await waitFor(() =>
    expect(Object.values(result.current).every((query) => query.hasNextPage)).toBe(true),
  );
  await act(async () => {
    await Promise.all(Object.values(result.current).map((query) => query.fetchNextPage()));
  });
  expect(getAdminPartners).toHaveBeenLastCalledWith(
    expect.objectContaining({ cursor: "list-next", accessToken: "A" }),
  );
  expect(getAdminPartnerReferrals).toHaveBeenLastCalledWith(
    expect.objectContaining({ cursor: "ref-next" }),
  );
  expect(getAdminPartnerActivity).toHaveBeenLastCalledWith(
    expect.objectContaining({ cursor: "audit-next" }),
  );
  await waitFor(() =>
    expect(result.current.list.data?.pages.flatMap((page) => page.items)).toHaveLength(2),
  );
  await waitFor(() =>
    expect(Object.values(result.current).every((query) => !query.hasNextPage)).toBe(true),
  );
});

it.each([
  null,
  { user: { id: ADMIN_USER_A, permissions: [] }, accessToken: "A" },
  {
    user: { id: ADMIN_USER_A, permissions: [], email: "tognolimauricio@gmail.com" },
    accessToken: "A",
  },
  { user: { id: ADMIN_USER_A, permissions: ["PARTNERS_VIEW"] }, accessToken: "" },
])("does not dispatch without explicit VIEW authority: %#", (auth) => {
  mockAuth = auth;
  renderHook(
    () => {
      useAdminPartners();
      useAdminPartner(ADMIN_PARTNER_ID);
      useAdminPartnerReferrals(ADMIN_PARTNER_ID);
      useAdminPartnerActivity(ADMIN_PARTNER_ID);
      useAdminDashboardSummary();
    },
    { wrapper: Wrapper },
  );
  services.forEach((service) => {
    expect(service).not.toHaveBeenCalled();
  });
});

it("does not dispatch a request after the token changes before an auth rerender", () => {
  tokenStore.set("B");
  renderHook(() => useAdminPartners(), { wrapper: Wrapper });
  expect(getAdminPartners).not.toHaveBeenCalled();
});

it("user B never inherits A's fresh admin list or summary caches", async () => {
  jest.mocked(getAdminPartners).mockResolvedValueOnce(buildAdminPage());
  jest.mocked(getAdminDashboardSummary).mockResolvedValueOnce(buildAdminSummary());
  const next = deferred<ReturnType<typeof buildAdminPage>>();
  const nextSummary = deferred<ReturnType<typeof buildAdminSummary>>();
  const { result, rerender } = renderHook(
    () => ({ list: useAdminPartners(), dashboard: useAdminDashboardSummary() }),
    { wrapper: Wrapper },
  );
  await waitFor(() =>
    expect(result.current.list.isSuccess && result.current.dashboard.isSuccess).toBe(true),
  );
  jest.mocked(getAdminPartners).mockReturnValueOnce(next.promise);
  jest.mocked(getAdminDashboardSummary).mockReturnValueOnce(nextSummary.promise);
  mockAuth = { user: { id: ADMIN_USER_B, permissions: ["PARTNERS_VIEW"] }, accessToken: "B" };
  tokenStore.set("B");
  rerender();
  expect(result.current.list.data).toBeUndefined();
  expect(result.current.dashboard.data).toBeUndefined();
  await act(async () => {
    next.resolve(buildAdminPage(buildAdminPartner({ displayName: "Partner B" })));
    nextSummary.resolve(buildAdminSummary());
  });
  await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
  expect(result.current.list.data?.pages[0].items[0].displayName).toBe("Partner B");
});

it("logout aborts A and a late response cannot refill A's cache", async () => {
  const pending = deferred<ReturnType<typeof buildAdminPage>>();
  jest
    .mocked(getAdminPartners)
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(buildAdminPage(buildAdminPartner({ displayName: "B" })));
  const { result, rerender } = renderHook(() => useAdminPartners(), { wrapper: Wrapper });
  const signal = jest.mocked(getAdminPartners).mock.calls[0][0].signal;
  mockAuth = null;
  tokenStore.set(null);
  rerender();
  expect(signal?.aborted).toBe(true);
  expect(result.current.data).toBeUndefined();
  mockAuth = { user: { id: ADMIN_USER_B, permissions: ["PARTNERS_VIEW"] }, accessToken: "B" };
  tokenStore.set("B");
  rerender();
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  await act(async () => {
    pending.resolve(buildAdminPage());
  });
  expect(result.current.data?.pages[0].items[0].displayName).toBe("B");
  expect(
    client
      .getQueriesData({ queryKey: partnersKeys.adminRead(ADMIN_USER_A) })
      .every(([, data]) => data === undefined),
  ).toBe(true);
});

it("rejects a completed A response after tokenStore switches even before rerender", async () => {
  const pending = deferred<ReturnType<typeof buildAdminPartner>>();
  jest.mocked(getAdminPartner).mockReturnValue(pending.promise);
  const { result } = renderHook(() => useAdminPartner(ADMIN_PARTNER_ID), { wrapper: Wrapper });
  tokenStore.set("B");
  await act(async () => {
    pending.resolve(buildAdminPartner());
  });
  expect(result.current.data).toBeUndefined();
  expect(
    client
      .getQueriesData({ queryKey: partnersKeys.adminRead(ADMIN_USER_A) })
      .every(([, data]) => data === undefined),
  ).toBe(true);
});

it("ignores old global mock cache entries and exposes errors without a fallback", async () => {
  jest.mocked(getAdminPartners).mockRejectedValue(new Error("Unavailable"));
  const { result } = renderHook(() => useAdminPartners(), { wrapper: Wrapper });
  client.setQueryData(["partners", "admin-partners"], [{ name: "OLD MOCK" }]);
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
});

it.each([401, 403])(
  "a sibling HTTP %s denies the full current session and removes fresh private caches",
  async (status) => {
    jest.mocked(getAdminPartner).mockResolvedValue(buildAdminPartner());
    jest.mocked(getAdminDashboardSummary).mockResolvedValue(buildAdminSummary());
    const activity = deferred<Awaited<ReturnType<typeof getAdminPartnerActivity>>>();
    jest.mocked(getAdminPartnerActivity).mockReturnValue(activity.promise);
    const { result, rerender } = renderHook(
      ({ referrals }) => ({
        detail: useAdminPartner(ADMIN_PARTNER_ID),
        dashboard: useAdminDashboardSummary(),
        activity: useAdminPartnerActivity(ADMIN_PARTNER_ID),
        referrals: useAdminPartnerReferrals(ADMIN_PARTNER_ID, referrals),
        access: useAdminReadAccess(),
      }),
      { wrapper: Wrapper, initialProps: { referrals: false } },
    );
    await waitFor(() =>
      expect(result.current.detail.isSuccess && result.current.dashboard.isSuccess).toBe(true),
    );
    const signal = jest.mocked(getAdminPartnerActivity).mock.calls[0][0].signal;
    jest.mocked(getAdminPartnerReferrals).mockRejectedValue(buildAxiosError(status));
    rerender({ referrals: true });
    await waitFor(() => expect(result.current.access.denied).not.toBeNull());
    expect(signal?.aborted).toBe(true);
    expect(
      client
        .getQueriesData({ queryKey: partnersKeys.adminRead(ADMIN_USER_A) })
        .every(([, data]) => data === undefined),
    ).toBe(true);
    await act(async () => {
      activity.resolve({ ...buildAdminPage(), items: [buildAdminActivity()] });
    });
    expect(result.current.activity.data).toBeUndefined();
    const callCount = jest.mocked(getAdminPartner).mock.calls.length;
    await act(async () => {
      await result.current.detail.refetch();
    });
    expect(getAdminPartner).toHaveBeenCalledTimes(callCount);
  },
);

it("a refreshed bearer for the same user cannot inherit the previous fresh cache", async () => {
  jest.mocked(getAdminPartner).mockResolvedValueOnce(buildAdminPartner());
  const pending = deferred<ReturnType<typeof buildAdminPartner>>();
  const { result, rerender } = renderHook(() => useAdminPartner(ADMIN_PARTNER_ID), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  jest.mocked(getAdminPartner).mockReturnValueOnce(pending.promise);
  mockAuth = { user: { id: ADMIN_USER_A, permissions: ["PARTNERS_VIEW"] }, accessToken: "B" };
  tokenStore.set("B");
  rerender();
  expect(result.current.data).toBeUndefined();
  expect(getAdminPartner).toHaveBeenLastCalledWith(expect.objectContaining({ accessToken: "B" }));
  await act(async () => {
    pending.resolve(buildAdminPartner({ displayName: "Refreshed" }));
  });
  await waitFor(() => expect(result.current.data?.displayName).toBe("Refreshed"));
});

it("an old A rejection cannot deny B or purge B's successful caches for the same user", async () => {
  let reject!: (error: Error) => void;
  const pendingA = new Promise<ReturnType<typeof buildAdminPartner>>((_resolve, fail) => {
    reject = fail;
  });
  jest
    .mocked(getAdminPartner)
    .mockReturnValueOnce(pendingA)
    .mockResolvedValueOnce(buildAdminPartner({ displayName: "B current" }));
  const { result, rerender } = renderHook(
    () => ({ detail: useAdminPartner(ADMIN_PARTNER_ID), access: useAdminReadAccess() }),
    { wrapper: Wrapper },
  );
  mockAuth = { user: { id: ADMIN_USER_A, permissions: ["PARTNERS_VIEW"] }, accessToken: "B" };
  tokenStore.set("B");
  rerender();
  await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));
  await act(async () => {
    reject(buildAxiosError(403));
  });
  expect(result.current.access.denied).toBeNull();
  expect(result.current.detail.data?.displayName).toBe("B current");
});

it("a new bearer may retry after a known denial with no retained private data", async () => {
  jest.mocked(getAdminPartner).mockRejectedValueOnce(buildAxiosError(403));
  const { result, rerender } = renderHook(
    () => ({ detail: useAdminPartner(ADMIN_PARTNER_ID), access: useAdminReadAccess() }),
    { wrapper: Wrapper },
  );
  await waitFor(() => expect(result.current.access.denied).not.toBeNull());
  jest
    .mocked(getAdminPartner)
    .mockResolvedValueOnce(buildAdminPartner({ displayName: "B current" }));
  mockAuth = { user: { id: ADMIN_USER_A, permissions: ["PARTNERS_VIEW"] }, accessToken: "B" };
  tokenStore.set("B");
  rerender();
  expect(result.current.access.denied).toBeNull();
  expect(result.current.detail.data).toBeUndefined();
  await waitFor(() => expect(result.current.detail.data?.displayName).toBe("B current"));
});

it("returning to an earlier bearer still checks the live API and never reuses its old cache", async () => {
  jest
    .mocked(getAdminPartner)
    .mockResolvedValueOnce(buildAdminPartner({ displayName: "Old A" }))
    .mockResolvedValueOnce(buildAdminPartner({ displayName: "B" }));
  const { result, rerender } = renderHook(() => useAdminPartner(ADMIN_PARTNER_ID), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.data?.displayName).toBe("Old A"));
  mockAuth = { user: { id: ADMIN_USER_A, permissions: ["PARTNERS_VIEW"] }, accessToken: "B" };
  tokenStore.set("B");
  rerender();
  await waitFor(() => expect(result.current.data?.displayName).toBe("B"));
  const pending = deferred<ReturnType<typeof buildAdminPartner>>();
  jest.mocked(getAdminPartner).mockReturnValueOnce(pending.promise);
  mockAuth.accessToken = "A";
  tokenStore.set("A");
  rerender();
  expect(result.current.data).toBeUndefined();
  expect(getAdminPartner).toHaveBeenCalledTimes(3);
  await act(async () => {
    pending.resolve(buildAdminPartner({ displayName: "Checked A" }));
  });
  await waitFor(() => expect(result.current.data?.displayName).toBe("Checked A"));
});

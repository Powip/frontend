import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import QueryProvider from "@/components/providers/QueryProvider";
import { tokenStore } from "@/lib/tokenStore";
import { partnersKeys } from "../../keys/partners.keys";
import { toPartnerAttribution } from "../../mappers/to-partner-attribution";
import type { PartnerAttributionPage } from "../../models/partner-attribution";
import { getPartnerAttributions } from "../../services/get-partner-attributions";
import { ATTRIBUTION_USER_A, ATTRIBUTION_USER_B, buildAttributionDto } from "../../test-utils/partner-attribution.fixture";
import { usePartnerAttributions } from "../use-partner-attributions";

let mockAuth: { user: { id: string }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@tanstack/react-query-devtools", () => ({ ReactQueryDevtools: () => null }));
jest.mock("../../services/get-partner-attributions", () => ({ getPartnerAttributions: jest.fn() }));

const TOKEN_A = "fixture-session-A";
const TOKEN_B = "fixture-session-B";
const pageA: PartnerAttributionPage = { items: [toPartnerAttribution(buildAttributionDto())], nextCursor: null };
const pageB: PartnerAttributionPage = {
  items: [toPartnerAttribution(buildAttributionDto({
    id: "66666666-6666-4666-8666-666666666666", companyId: "77777777-7777-4777-8777-777777777777",
  }))],
  nextCursor: null,
};
let queryClient: QueryClient;

function QueryProbe() { queryClient = useQueryClient(); return null; }
function PartnersQueryTestWrapper({ children }: { children: React.ReactNode }) {
  return <QueryProvider><QueryProbe />{children}</QueryProvider>;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

beforeEach(() => {
  mockAuth = { user: { id: ATTRIBUTION_USER_A }, accessToken: TOKEN_A };
  tokenStore.set(TOKEN_A);
  jest.mocked(getPartnerAttributions).mockReset();
});
afterEach(() => { cleanup(); queryClient?.clear(); tokenStore.set(null); });

it("loads the first page with the initiating bearer and an abort signal", async () => {
  const pending = deferred<PartnerAttributionPage>();
  jest.mocked(getPartnerAttributions).mockReturnValue(pending.promise);
  const { result } = renderHook(() => usePartnerAttributions(), { wrapper: PartnersQueryTestWrapper });
  expect(result.current.isLoading).toBe(true);
  expect(getPartnerAttributions).toHaveBeenCalledWith(null, TOKEN_A, expect.any(AbortSignal));
  await act(async () => { pending.resolve(pageA); });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.pages).toEqual([pageA]);
  expect(JSON.stringify(partnersKeys.attributions(ATTRIBUTION_USER_A))).not.toContain(TOKEN_A);
});

it("follows the cursor and accumulates pages without a limit or owner selector", async () => {
  jest.mocked(getPartnerAttributions)
    .mockResolvedValueOnce({ ...pageA, nextCursor: "opaque-next" }).mockResolvedValueOnce(pageB);
  const { result } = renderHook(() => usePartnerAttributions(), { wrapper: PartnersQueryTestWrapper });
  await waitFor(() => expect(result.current.hasNextPage).toBe(true));
  await act(async () => { await result.current.fetchNextPage(); });
  expect(getPartnerAttributions).toHaveBeenLastCalledWith("opaque-next", TOKEN_A, expect.any(AbortSignal));
  await waitFor(() => expect(result.current.data?.pages.flatMap((page) => page.items)).toEqual([...pageA.items, ...pageB.items]));
  expect(result.current.hasNextPage).toBe(false);
});

it.each([null, { user: { id: ATTRIBUTION_USER_A }, accessToken: "" }, { user: { id: "" }, accessToken: TOKEN_A }])(
  "does not dispatch without a complete auth identity: %#", (auth) => {
    mockAuth = auth;
    const { result } = renderHook(() => usePartnerAttributions(), { wrapper: PartnersQueryTestWrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(getPartnerAttributions).not.toHaveBeenCalled();
  },
);

it("does not dispatch when permission disables the section or tokenStore is no longer A", () => {
  const { rerender } = renderHook(({ enabled }) => usePartnerAttributions(enabled), {
    wrapper: PartnersQueryTestWrapper, initialProps: { enabled: false },
  });
  expect(getPartnerAttributions).not.toHaveBeenCalled();
  tokenStore.set(TOKEN_B);
  rerender({ enabled: true });
  expect(getPartnerAttributions).not.toHaveBeenCalled();
});

it("B never inherits A's fresh cache with the real QueryProvider defaults", async () => {
  jest.mocked(getPartnerAttributions).mockResolvedValueOnce(pageA);
  const pendingB = deferred<PartnerAttributionPage>();
  const { result, rerender } = renderHook(() => usePartnerAttributions(), { wrapper: PartnersQueryTestWrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  jest.mocked(getPartnerAttributions).mockReturnValueOnce(pendingB.promise);
  mockAuth = { user: { id: ATTRIBUTION_USER_B }, accessToken: TOKEN_B };
  tokenStore.set(TOKEN_B);
  rerender();
  expect(result.current.data).toBeUndefined();
  await act(async () => { pendingB.resolve(pageB); });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.pages).toEqual([pageB]);
  expect(getPartnerAttributions).toHaveBeenLastCalledWith(null, TOKEN_B, expect.any(AbortSignal));
});

it("logout and a late A response cannot populate a query after B is current", async () => {
  const pendingA = deferred<PartnerAttributionPage>();
  jest.mocked(getPartnerAttributions).mockReturnValueOnce(pendingA.promise).mockResolvedValueOnce(pageB);
  const { result, rerender } = renderHook(() => usePartnerAttributions(), { wrapper: PartnersQueryTestWrapper });
  const signal = jest.mocked(getPartnerAttributions).mock.calls[0][2];
  mockAuth = null;
  tokenStore.set(null);
  rerender();
  expect(signal?.aborted).toBe(true);
  expect(result.current.data).toBeUndefined();
  mockAuth = { user: { id: ATTRIBUTION_USER_B }, accessToken: TOKEN_B };
  tokenStore.set(TOKEN_B);
  rerender();
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  await act(async () => { pendingA.resolve(pageA); });
  expect(result.current.data?.pages).toEqual([pageB]);
  expect(queryClient.getQueryData(partnersKeys.attributions(ATTRIBUTION_USER_A))).toBeUndefined();
});

it("a response is rejected if the bearer changes even before an auth rerender", async () => {
  const pending = deferred<PartnerAttributionPage>();
  jest.mocked(getPartnerAttributions).mockReturnValue(pending.promise);
  const { result } = renderHook(() => usePartnerAttributions(), { wrapper: PartnersQueryTestWrapper });
  tokenStore.set(TOKEN_B);
  await act(async () => { pending.resolve(pageA); });
  expect(result.current.data).toBeUndefined();
  expect(queryClient.getQueryData(partnersKeys.attributions(ATTRIBUTION_USER_A))).toBeUndefined();
});

it("exposes an HTTP failure without a mock fallback", async () => {
  jest.mocked(getPartnerAttributions).mockRejectedValue(new Error("Fixture unavailable"));
  const { result } = renderHook(() => usePartnerAttributions(), { wrapper: PartnersQueryTestWrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
});

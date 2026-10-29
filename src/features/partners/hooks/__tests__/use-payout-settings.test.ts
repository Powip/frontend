import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { tokenStore } from "@/lib/tokenStore";
import { getPayoutSettings } from "../../services/get-payout-settings";
import { clearAdminCapabilityDenials } from "../../utils/admin-capability-session-state";
import { clearAdminReadDenial } from "../../utils/admin-read-session-state";
import { usePayoutSettings } from "../use-payout-settings";
let mockAuth: { user: { id: string }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("../../services/get-payout-settings", () => ({ getPayoutSettings: jest.fn() }));
const USER_A = "11111111-1111-4111-8111-111111111111", USER_B = "22222222-2222-4222-8222-222222222222";
const settings = { method: "yape" as const, accountNumber: "fixture-account", accountHolder: "Fixture holder", version: 0, updatedAt: "2026-10-11T00:00:00Z" };
let client: QueryClient;
function wrapper() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function QueryWrapper({ children }: { children: React.ReactNode }) { return React.createElement(QueryClientProvider, { client }, children); };
}
beforeEach(() => { clearAdminCapabilityDenials(); clearAdminReadDenial(); mockAuth = { user: { id: USER_A }, accessToken: "session-A" }; tokenStore.set("session-A"); jest.mocked(getPayoutSettings).mockReset(); });
afterEach(() => { cleanup(); client?.clear(); tokenStore.set(null); clearAdminCapabilityDenials(); clearAdminReadDenial(); });
it("reads only actual owned settings with the captured Bearer", async () => {
  jest.mocked(getPayoutSettings).mockResolvedValue(settings);
  const { result } = renderHook(() => usePayoutSettings(), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual(settings);
  expect(getPayoutSettings).toHaveBeenCalledWith("session-A", expect.any(AbortSignal));
});
it("absent settings remain null, not sample values", async () => {
  jest.mocked(getPayoutSettings).mockResolvedValue(null);
  const { result } = renderHook(() => usePayoutSettings(), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true)); expect(result.current.data).toBeNull();
});
it("never dispatches without a current session", () => {
  mockAuth = null; tokenStore.set(null);
  const { result } = renderHook(() => usePayoutSettings(), { wrapper: wrapper() });
  expect(result.current.fetchStatus).toBe("idle"); expect(getPayoutSettings).not.toHaveBeenCalled();
});
it("immediately separates accounts and ignores late responses from the previous owner", async () => {
  let complete!: (value: typeof settings) => void;
  jest.mocked(getPayoutSettings).mockReturnValueOnce(new Promise((resolve) => { complete = resolve; })).mockResolvedValue(null);
  const { result, rerender } = renderHook(() => usePayoutSettings(), { wrapper: wrapper() });
  await waitFor(() => expect(getPayoutSettings).toHaveBeenCalledTimes(1));
  mockAuth = { user: { id: USER_B }, accessToken: "session-B" }; tokenStore.set("session-B"); rerender();
  expect(result.current.data).toBeUndefined();
  await act(async () => { complete(settings); });
  await waitFor(() => expect(result.current.data).toBeNull());
  expect(JSON.stringify(client.getQueryCache().getAll().map((q) => q.queryKey))).not.toContain("session-A");
  expect(client.getQueryCache().getAll().some((q) => q.state.data === settings)).toBe(false);
});

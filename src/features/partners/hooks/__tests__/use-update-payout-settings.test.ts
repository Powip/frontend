import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { toast } from "sonner";
import { tokenStore } from "@/lib/tokenStore";
import { partnersKeys } from "../../keys/partners.keys";
import { updatePayoutSettings } from "../../services/update-payout-settings";
import { clearAdminCapabilityDenials } from "../../utils/admin-capability-session-state";
import { adminReadSessionEpoch, clearAdminReadDenial } from "../../utils/admin-read-session-state";
import { useUpdatePayoutSettings } from "../use-update-payout-settings";

let mockAuth: { user: { id: string }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("../../services/update-payout-settings", () => ({ updatePayoutSettings: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const USER_A = "11111111-1111-4111-8111-111111111111";
const command = {
  method: "yape" as const,
  accountNumber: "fixture-account",
  accountHolder: "Fixture holder",
  expectedVersion: null,
  reason: "Protected reason",
};
const settings = {
  method: "yape" as const,
  accountNumber: "fixture-account",
  accountHolder: "Fixture holder",
  version: 0,
  updatedAt: "2026-10-11T00:00:00Z",
};
let client: QueryClient;
function wrapper() {
  client = new QueryClient();
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}
beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  Object.defineProperty(globalThis, "TextEncoder", { value: TextEncoder, configurable: true });
});
beforeEach(() => {
  clearAdminCapabilityDenials();
  clearAdminReadDenial();
  sessionStorage.clear();
  mockAuth = { user: { id: USER_A }, accessToken: "session-A" };
  tokenStore.set("session-A");
  jest.mocked(updatePayoutSettings).mockReset().mockResolvedValue(settings);
  jest.mocked(toast.success).mockClear();
  jest.mocked(toast.error).mockClear();
});
afterEach(() => {
  cleanup();
  client?.clear();
  tokenStore.set(null);
  clearAdminCapabilityDenials();
  clearAdminReadDenial();
  sessionStorage.clear();
});
it("writes only user/session-scoped cache after actual confirmation", async () => {
  const { result } = renderHook(() => useUpdatePayoutSettings(), { wrapper: wrapper() });
  await act(async () => result.current.mutate(command));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  const query = client.getQueryCache().getAll()[0];
  expect(query.queryKey).toEqual(
    partnersKeys.payoutSettings(USER_A, result.current.variables?.epoch),
  );
  expect(query.state.data).toEqual(settings);
  expect(toast.success).toHaveBeenCalled();
});
it("does not replace newer current settings with an older immutable replay receipt", async () => {
  const { result } = renderHook(() => useUpdatePayoutSettings(), { wrapper: wrapper() });
  const queryKey = partnersKeys.payoutSettings(USER_A, adminReadSessionEpoch("session-A"));
  const currentSettings = { ...settings, accountNumber: "newer-current-account", version: 2 };
  client.setQueryData(queryKey, currentSettings);
  const invalidate = jest.spyOn(client, "invalidateQueries");
  await act(async () => result.current.mutate(command));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual(settings);
  expect(client.getQueryData(queryKey)).toEqual(currentSettings);
  expect(invalidate).toHaveBeenCalledWith({ queryKey });
});
it("preserves retry key for an unknown result, including remount/retry without persisting account or reason", async () => {
  jest.mocked(updatePayoutSettings).mockRejectedValueOnce(new Error("Response lost after commit"));
  const { result, unmount } = renderHook(() => useUpdatePayoutSettings(), { wrapper: wrapper() });
  await act(async () => result.current.mutate(command));
  await waitFor(() => expect(result.current.isError).toBe(true));
  unmount();
  const next = renderHook(() => useUpdatePayoutSettings(), { wrapper: wrapper() });
  await act(async () => next.result.current.mutate(command));
  await waitFor(() => expect(next.result.current.isSuccess).toBe(true));
  const calls = jest.mocked(updatePayoutSettings).mock.calls;
  expect(calls[0][0].idempotencyKey).toBe(calls[1][0].idempotencyKey);
  const stored =
    sessionStorage.getItem(`powip:partners:admin-command:payout-settings.save:${USER_A}`) ?? "";
  expect(stored).not.toContain(command.accountNumber);
  expect(stored).not.toContain(command.accountHolder);
  expect(stored).not.toContain(command.reason);
  expect(stored).not.toContain("session-A");
});
it("aborts logout in-flight requests and ignores late success, cache and toast", async () => {
  let complete!: (value: typeof settings) => void;
  jest.mocked(updatePayoutSettings).mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  const { result, rerender } = renderHook(() => useUpdatePayoutSettings(), { wrapper: wrapper() });
  await act(async () => result.current.mutate(command));
  await waitFor(() => expect(updatePayoutSettings).toHaveBeenCalled());
  const signal = jest.mocked(updatePayoutSettings).mock.calls[0][0].signal;
  mockAuth = null;
  tokenStore.set(null);
  rerender();
  expect(signal?.aborted).toBe(true);
  await act(async () => complete(settings));
  expect(result.current.data).toBeUndefined();
  expect(toast.success).not.toHaveBeenCalled();
  expect(client.getQueryCache().getAll()).toHaveLength(0);
});

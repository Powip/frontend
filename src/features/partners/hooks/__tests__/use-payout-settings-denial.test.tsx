import { CancelledError, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { tokenStore } from "@/lib/tokenStore";
import type { PayoutSettings } from "../../models/payout-settings";
import type { PayoutSettingsCommand } from "../../schemas/update-payout-settings.schema";
import { getPayoutSettings } from "../../services/get-payout-settings";
import { updatePayoutSettings } from "../../services/update-payout-settings";
import { buildAxiosError } from "../../test-utils/axios-error";
import { clearAdminCapabilityDenials } from "../../utils/admin-capability-session-state";
import { resolveAdminCommandIdempotencyKey } from "../../utils/admin-command-idempotency";
import {
  adminReadDenialFor,
  clearAdminReadDenial,
  denyAdminReadSession,
} from "../../utils/admin-read-session-state";
import { usePayoutSettings } from "../use-payout-settings";
import { useUpdatePayoutSettings } from "../use-update-payout-settings";

let mockAuth: { user: { id: string }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("../../services/get-payout-settings", () => ({ getPayoutSettings: jest.fn() }));
jest.mock("../../services/update-payout-settings", () => ({ updatePayoutSettings: jest.fn() }));
jest.mock("../../utils/admin-command-idempotency", () => ({
  resolveAdminCommandIdempotencyKey: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const USER = "11111111-1111-4111-8111-111111111111";
const settings: PayoutSettings = {
  method: "yape",
  accountNumber: "fixture-private-account",
  accountHolder: "Fixture private holder",
  version: 0,
  updatedAt: "2026-10-11T00:00:00Z",
};
const command: PayoutSettingsCommand = {
  method: "plin",
  accountNumber: "fixture-new-account",
  accountHolder: "Fixture new holder",
  expectedVersion: 0,
  reason: "Fixture requested change",
};
let client: QueryClient;
function wrapper() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300_000 } } });
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
  clearAdminCapabilityDenials();
  clearAdminReadDenial();
  mockAuth = { user: { id: USER }, accessToken: "private-bearer-A" };
  tokenStore.set(mockAuth.accessToken);
  jest.mocked(getPayoutSettings).mockReset().mockResolvedValue(settings);
  jest
    .mocked(updatePayoutSettings)
    .mockReset()
    .mockResolvedValue({ ...settings, version: 1 });
  jest
    .mocked(resolveAdminCommandIdempotencyKey)
    .mockReset()
    .mockResolvedValue("stable-payout-retry-key");
});
afterEach(() => {
  cleanup();
  client?.clear();
  tokenStore.set(null);
  clearAdminCapabilityDenials();
  clearAdminReadDenial();
});

it("shares a write 403 across readers, purges sensitive cache and rejects a late read", async () => {
  const { result, rerender } = renderHook(
    () => ({
      page: usePayoutSettings(),
      dialog: usePayoutSettings(),
      write: useUpdatePayoutSettings(),
    }),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(result.current.page.data).toEqual(settings));
  const pending = deferred<PayoutSettings | null>();
  jest.mocked(getPayoutSettings).mockReturnValueOnce(pending.promise);
  let refetch!: ReturnType<typeof result.current.page.refetch>;
  await act(async () => {
    refetch = result.current.page.refetch();
    await Promise.resolve();
  });
  await waitFor(() => expect(getPayoutSettings).toHaveBeenCalledTimes(2));
  const readSignal = jest.mocked(getPayoutSettings).mock.calls[1][1];
  const denied = buildAxiosError(403);
  jest.mocked(updatePayoutSettings).mockRejectedValueOnce(denied);
  await act(async () => {
    await expect(
      result.current.write.mutateAsync({
        command,
        epoch: result.current.page.session.epoch,
        userId: USER,
      }),
    ).rejects.toBe(denied);
  });
  await waitFor(() => expect(result.current.page.session.denied).toBe(denied));
  expect(result.current.dialog.session.denied).toBe(denied);
  expect(result.current.page.data).toBeUndefined();
  expect(result.current.dialog.data).toBeUndefined();
  expect(result.current.page.session.enabled).toBe(false);
  expect(readSignal?.aborted).toBe(true);
  expect(adminReadDenialFor(USER, "private-bearer-A")).toBeNull();
  await act(async () => {
    pending.resolve(settings);
    await refetch;
  });
  expect(result.current.page.data).toBeUndefined();
  expect(
    client
      .getQueryCache()
      .getAll()
      .some((query) => query.state.data !== undefined),
  ).toBe(false);
  rerender();
  await act(async () => {
    await expect(
      result.current.write.mutateAsync({
        command,
        epoch: result.current.page.session.epoch,
        userId: USER,
      }),
    ).rejects.toBeInstanceOf(CancelledError);
    await result.current.page.refetch();
  });
  expect(getPayoutSettings).toHaveBeenCalledTimes(2);
  expect(updatePayoutSettings).toHaveBeenCalledTimes(1);
});

it("a renewed bearer starts a clean payout session without resurrecting denied data", async () => {
  const { result, rerender } = renderHook(
    () => ({
      read: usePayoutSettings(),
      write: useUpdatePayoutSettings(),
    }),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(result.current.read.data).toEqual(settings));
  const oldEpoch = result.current.read.session.epoch;
  const denied = buildAxiosError(403);
  jest.mocked(updatePayoutSettings).mockRejectedValueOnce(denied);
  await act(async () => {
    await expect(
      result.current.write.mutateAsync({ command, epoch: oldEpoch, userId: USER }),
    ).rejects.toBe(denied);
  });
  await waitFor(() => expect(result.current.read.session.denied).toBe(denied));
  const pending = deferred<PayoutSettings | null>();
  jest.mocked(getPayoutSettings).mockReturnValueOnce(pending.promise);
  mockAuth = { user: { id: USER }, accessToken: "private-bearer-B" };
  tokenStore.set(mockAuth.accessToken);
  rerender();
  expect(result.current.read.session.epoch).not.toBe(oldEpoch);
  expect(result.current.read.session.denied).toBeNull();
  expect(result.current.read.data).toBeUndefined();
  await act(async () => {
    pending.resolve(null);
  });
  await waitFor(() => expect(result.current.read.data).toBeNull());
  expect(getPayoutSettings).toHaveBeenLastCalledWith("private-bearer-B", expect.any(AbortSignal));
  const updated = { ...settings, version: 1 };
  jest.mocked(updatePayoutSettings).mockResolvedValueOnce(updated);
  jest.mocked(getPayoutSettings).mockResolvedValueOnce(updated);
  await act(async () => {
    await result.current.write.mutateAsync({
      command,
      epoch: result.current.read.session.epoch,
      userId: USER,
    });
  });
  await waitFor(() => expect(result.current.read.data).toEqual(updated));
  expect(updatePayoutSettings).toHaveBeenLastCalledWith(
    expect.objectContaining({
      accessToken: "private-bearer-B",
      idempotencyKey: "stable-payout-retry-key",
      command,
    }),
  );
  expect(
    JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey),
    ),
  ).not.toContain("private-bearer");
});

it("pins an in-flight idempotency calculation and suppresses dispatch after another reader denies access", async () => {
  const { result } = renderHook(
    () => ({
      read: usePayoutSettings(),
      write: useUpdatePayoutSettings(),
    }),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(result.current.read.data).toEqual(settings));
  const pendingKey = deferred<string>();
  jest.mocked(resolveAdminCommandIdempotencyKey).mockReturnValueOnce(pendingKey.promise);
  let attempt!: Promise<unknown>;
  await act(async () => {
    attempt = result.current.write.mutateAsync({
      command,
      epoch: result.current.read.session.epoch,
      userId: USER,
    });
    await Promise.resolve();
  });
  await waitFor(() => expect(resolveAdminCommandIdempotencyKey).toHaveBeenCalledTimes(1));
  const denied = buildAxiosError(403);
  jest.mocked(getPayoutSettings).mockRejectedValueOnce(denied);
  await act(async () => {
    await result.current.read.refetch();
  });
  await waitFor(() => expect(result.current.read.session.denied).toBe(denied));
  await act(async () => {
    pendingKey.resolve("stable-payout-retry-key");
    await expect(attempt).rejects.toBeInstanceOf(CancelledError);
  });
  expect(updatePayoutSettings).not.toHaveBeenCalled();
  expect(result.current.read.data).toBeUndefined();
});

it("an external shared 401 aborts the payout read and purges its already-cached account", async () => {
  const { result } = renderHook(
    () => ({ read: usePayoutSettings(), write: useUpdatePayoutSettings() }),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(result.current.read.data).toEqual(settings));
  const pending = deferred<PayoutSettings | null>();
  jest.mocked(getPayoutSettings).mockReturnValueOnce(pending.promise);
  let refetch!: ReturnType<typeof result.current.read.refetch>;
  await act(async () => {
    refetch = result.current.read.refetch();
    await Promise.resolve();
  });
  await waitFor(() => expect(getPayoutSettings).toHaveBeenCalledTimes(2));
  const readSignal = jest.mocked(getPayoutSettings).mock.calls[1][1];
  const denied = buildAxiosError(401);
  await act(async () => {
    denyAdminReadSession(USER, "private-bearer-A", denied);
  });
  await waitFor(() => expect(readSignal?.aborted).toBe(true));
  expect(result.current.read.session.denied).toBe(denied);
  expect(result.current.read.data).toBeUndefined();
  expect(
    client
      .getQueryCache()
      .getAll()
      .some((query) => query.state.data !== undefined),
  ).toBe(false);
  await act(async () => {
    pending.resolve(settings);
    await refetch;
  });
  expect(
    client
      .getQueryCache()
      .getAll()
      .some((query) => query.state.data !== undefined),
  ).toBe(false);
  await act(async () => {
    await expect(
      result.current.write.mutateAsync({
        command,
        epoch: result.current.read.session.epoch,
        userId: USER,
      }),
    ).rejects.toBeInstanceOf(CancelledError);
  });
  expect(updatePayoutSettings).not.toHaveBeenCalled();
});

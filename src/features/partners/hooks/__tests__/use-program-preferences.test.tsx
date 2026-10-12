import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { CancelledError, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { tokenStore } from "@/lib/tokenStore";
import {
  requestProgramPreferences,
  requestUpdateProgramPreferences,
} from "../../api/program-preferences.api";
import type {
  ProgramPreferencesCommand,
  ProgramPreferencesResponse,
} from "../../models/program-preferences";
import { buildAxiosError } from "../../test-utils/axios-error";
import { programPreferencesFixture } from "../../test-utils/program-preferences.fixture";
import {
  adminReadDenialFor,
  clearAdminReadDenial,
  denyAdminReadSession,
} from "../../utils/admin-read-session-state";
import { clearProgramPreferencesDenial } from "../../utils/program-preferences-session-state";
import { useProgramPreferences } from "../use-program-preferences";
import { useUpdateProgramPreferences } from "../use-update-program-preferences";

let mockAuth: { user: { id: string }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("../../api/program-preferences.api", () => ({
  requestProgramPreferences: jest.fn(),
  requestUpdateProgramPreferences: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const command: ProgramPreferencesCommand = {
  optionCode: "B",
  discountPct: "5",
  expectedVersion: null,
  reason: "Private original reason",
};
const savedSettings = {
  optionCode: "B" as const,
  discountPct: "5",
  version: 0,
  updatedAt: "2026-10-11T10:00:00Z",
};
const saved = programPreferencesFixture(savedSettings);
let client: QueryClient;
function wrapper() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
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
beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  Object.defineProperty(globalThis, "TextEncoder", { value: TextEncoder, configurable: true });
});
beforeEach(() => {
  clearAdminReadDenial();
  clearProgramPreferencesDenial();
  sessionStorage.clear();
  mockAuth = { user: { id: USER_A }, accessToken: "private-A" };
  tokenStore.set(mockAuth.accessToken);
  jest.mocked(requestProgramPreferences).mockReset().mockResolvedValue(programPreferencesFixture());
  jest.mocked(requestUpdateProgramPreferences).mockReset().mockResolvedValue(saved);
});
afterEach(() => {
  cleanup();
  client?.clear();
  tokenStore.set(null);
  clearProgramPreferencesDenial();
  clearAdminReadDenial();
  sessionStorage.clear();
});

it("reads with the captured bearer and exposes no option/discount defaults", async () => {
  const { result } = renderHook(() => useProgramPreferences(), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.data?.settings).toBeNull());
  expect(requestProgramPreferences).toHaveBeenCalledWith({
    accessToken: "private-A",
    signal: expect.any(AbortSignal),
  });
  expect(
    JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey),
    ),
  ).not.toContain("private-A");
});

it.each([new Error("Response lost after commit"), buildAxiosError(503)])(
  "keeps the command and real stable retry key across an unknown result: %#",
  async (failure) => {
    jest
      .mocked(requestUpdateProgramPreferences)
      .mockRejectedValueOnce(failure)
      .mockResolvedValue(saved);
    const { result } = renderHook(
      () => ({ read: useProgramPreferences(), write: useUpdateProgramPreferences() }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.read.data).toBeDefined());
    await act(async () => {
      await expect(
        result.current.write.mutation.mutateAsync({
          command,
          epoch: result.current.write.session.epoch,
          userId: USER_A,
        }),
      ).rejects.toBe(failure);
    });
    await act(async () => {
      client.setQueryData(
        result.current.read.session.queryKey,
        programPreferencesFixture({ ...savedSettings, version: 4 }),
      );
    });
    await waitFor(() => expect(result.current.write.mutation.variables?.command).toBe(command));
    const retained = result.current.write.mutation.variables?.command;
    if (!retained) throw new Error("Original command missing");
    await act(async () => {
      await result.current.write.mutation.mutateAsync({
        command: retained,
        epoch: result.current.write.session.epoch,
        userId: USER_A,
      });
    });
    const calls = jest.mocked(requestUpdateProgramPreferences).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0].command).toEqual(command);
    expect(calls[1][0].command).toEqual(command);
    expect(calls[0][0].idempotencyKey).toBe(calls[1][0].idempotencyKey);
    const stored =
      sessionStorage.getItem(`powip:partners:admin-command:program-preferences.save:${USER_A}`) ??
      "";
    expect(stored).not.toContain(command.reason);
    expect(stored).not.toContain("private-A");
    expect(JSON.parse(stored).entries).toHaveLength(1);
  },
);

it("does not replace a newer current cache with an older replay receipt", async () => {
  const { result } = renderHook(() => useUpdateProgramPreferences(), { wrapper: wrapper() });
  const newer = programPreferencesFixture({ ...savedSettings, version: 8 });
  client.setQueryData(result.current.session.queryKey, newer);
  const invalidate = jest.spyOn(client, "invalidateQueries");
  await act(async () => {
    await result.current.mutation.mutateAsync({
      command,
      epoch: result.current.session.epoch,
      userId: USER_A,
    });
  });
  expect(client.getQueryData(result.current.session.queryKey)).toEqual(newer);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: result.current.session.queryKey });
});

it("a write 403 hides every reader, removes cache and suppresses another write without global 403", async () => {
  const { result } = renderHook(
    () => ({
      read: useProgramPreferences(),
      second: useProgramPreferences(),
      write: useUpdateProgramPreferences(),
    }),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(result.current.read.data).toBeDefined());
  const denied = buildAxiosError(403);
  jest.mocked(requestUpdateProgramPreferences).mockRejectedValueOnce(denied);
  await act(async () => {
    await expect(
      result.current.write.mutation.mutateAsync({
        command,
        epoch: result.current.write.session.epoch,
        userId: USER_A,
      }),
    ).rejects.toBe(denied);
  });
  await waitFor(() => expect(result.current.second.session.denied).toBe(denied));
  expect(result.current.read.data).toBeUndefined();
  expect(result.current.second.data).toBeUndefined();
  expect(result.current.write.mutationForSession).toBe(false);
  expect(adminReadDenialFor(USER_A, "private-A")).toBeNull();
  await act(async () => {
    await expect(
      result.current.write.mutation.mutateAsync({
        command,
        epoch: result.current.write.session.epoch,
        userId: USER_A,
      }),
    ).rejects.toBeInstanceOf(CancelledError);
  });
  expect(requestUpdateProgramPreferences).toHaveBeenCalledTimes(1);
  expect(
    client
      .getQueryCache()
      .getAll()
      .some((query) => query.state.data !== undefined),
  ).toBe(false);
});

it("aborts an old-user write and ignores late confirmation and invalidation", async () => {
  const pending = deferred<ProgramPreferencesResponse>();
  jest.mocked(requestUpdateProgramPreferences).mockReturnValueOnce(pending.promise);
  const { result, rerender } = renderHook(
    () => ({ read: useProgramPreferences(), write: useUpdateProgramPreferences() }),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(result.current.read.data).toBeDefined());
  const invalidate = jest.spyOn(client, "invalidateQueries");
  let completion!: Promise<unknown>;
  act(() => {
    completion = result.current.write.mutation
      .mutateAsync({ command, epoch: result.current.write.session.epoch, userId: USER_A })
      .catch((error) => error);
  });
  await waitFor(() => expect(requestUpdateProgramPreferences).toHaveBeenCalledTimes(1));
  const signal = jest.mocked(requestUpdateProgramPreferences).mock.calls[0][0].signal;
  mockAuth = { user: { id: USER_B }, accessToken: "private-B" };
  tokenStore.set(mockAuth.accessToken);
  rerender();
  expect(signal?.aborted).toBe(true);
  expect(result.current.write.mutationForSession).toBe(false);
  await act(async () => {
    pending.resolve(saved);
    expect(await completion).toBeInstanceOf(CancelledError);
  });
  expect(invalidate).not.toHaveBeenCalled();
  expect(result.current.write.mutationForSession).toBe(false);
});

it("shared 401 hides cached preferences and cancels an in-flight read", async () => {
  const { result } = renderHook(() => useProgramPreferences(), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.data).toBeDefined());
  const pending = deferred<ProgramPreferencesResponse>();
  jest.mocked(requestProgramPreferences).mockReturnValueOnce(pending.promise);
  let refetch!: ReturnType<typeof result.current.refetch>;
  await act(async () => {
    refetch = result.current.refetch();
    await Promise.resolve();
  });
  await waitFor(() => expect(requestProgramPreferences).toHaveBeenCalledTimes(2));
  const signal = jest.mocked(requestProgramPreferences).mock.calls[1][0].signal;
  const denied = buildAxiosError(401);
  await act(async () => {
    denyAdminReadSession(USER_A, "private-A", denied);
  });
  await waitFor(() => expect(signal?.aborted).toBe(true));
  expect(result.current.data).toBeUndefined();
  expect(result.current.session.denied).toBe(denied);
  await act(async () => {
    pending.resolve(saved);
    await refetch;
  });
  expect(result.current.data).toBeUndefined();
});

it("renewing the bearer creates a clean session without resurrecting a denial", async () => {
  jest.mocked(requestProgramPreferences).mockRejectedValueOnce(buildAxiosError(403));
  const { result, rerender } = renderHook(() => useProgramPreferences(), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.session.denied).toBeTruthy());
  const oldEpoch = result.current.session.epoch;
  mockAuth = { user: { id: USER_A }, accessToken: "private-renewed" };
  tokenStore.set(mockAuth.accessToken);
  rerender();
  expect(result.current.session.epoch).not.toBe(oldEpoch);
  expect(result.current.session.denied).toBeNull();
  await waitFor(() => expect(result.current.data?.settings).toBeNull());
  expect(requestProgramPreferences).toHaveBeenLastCalledWith({
    accessToken: "private-renewed",
    signal: expect.any(AbortSignal),
  });
});

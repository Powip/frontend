import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { CancelledError, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { tokenStore } from "@/lib/tokenStore";
import { requestReferralRejection } from "../../api/referral-rejection.api";
import { partnersKeys } from "../../keys/partners.keys";
import {
  ADMIN_PARTNER_ID,
  ADMIN_USER_A,
  ADMIN_USER_B,
} from "../../test-utils/admin-partners.fixture";
import { buildAxiosError } from "../../test-utils/axios-error";
import {
  clearAdminCapabilityDenials,
  getAdminCapabilityDenial,
} from "../../utils/admin-capability-session-state";
import { clearAdminReadDenial, denyAdminReadSession } from "../../utils/admin-read-session-state";
import { useReferralRejection } from "../use-referral-rejection";

let mockAuth: { user: { id: string; permissions: string[] }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("../../api/referral-rejection.api", () => ({ requestReferralRejection: jest.fn() }));
const input = {
  referralId: ADMIN_PARTNER_ID,
  command: { expectedVersion: 4, reason: "Private rejection reason" },
};
const confirmed = {
  id: ADMIN_PARTNER_ID,
  partnerId: ADMIN_USER_B,
  origin: "CODE" as const,
  state: "CANCELLED" as const,
  decision: "REJECTED" as const,
  version: 5,
  decidedAt: "2026-10-11T10:00:00Z",
};
let client: QueryClient;
function wrapper() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
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
  clearAdminCapabilityDenials();
  clearAdminReadDenial();
  sessionStorage.clear();
  mockAuth = {
    user: { id: ADMIN_USER_A, permissions: ["PARTNERS_VIEW", "PARTNERS_RESOLVE_REFERRAL"] },
    accessToken: "private-A",
  };
  tokenStore.set(mockAuth.accessToken);
  jest.mocked(requestReferralRejection).mockReset().mockResolvedValue(confirmed);
});
afterEach(() => {
  cleanup();
  client?.clear();
  tokenStore.set(null);
  clearAdminCapabilityDenials();
  clearAdminReadDenial();
  sessionStorage.clear();
});

it.each([
  { permissions: [] },
  { permissions: ["PARTNERS_VIEW"] },
  { permissions: ["PARTNERS_APPROVE"] },
  { permissions: ["PARTNERS_MANAGE_PARTNERS"] },
  { permissions: ["ROLE_SUPERADMIN"] },
])(
  "requires only its independent current capability before storing key or HTTP: %p",
  async ({ permissions }) => {
    if (mockAuth) mockAuth.user.permissions = permissions;
    const { result } = renderHook(() => useReferralRejection(), { wrapper: wrapper() });
    expect(result.current.session.enabled).toBe(false);
    await act(async () => {
      await expect(result.current.write(input)).rejects.toBeInstanceOf(CancelledError);
    });
    expect(requestReferralRejection).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
  },
);

it("replays the exact immutable command/key after lost response and queue change without persisted PII", async () => {
  jest
    .mocked(requestReferralRejection)
    .mockRejectedValueOnce(new Error("Response lost after commit"))
    .mockResolvedValue(confirmed);
  const { result } = renderHook(() => useReferralRejection(), { wrapper: wrapper() });
  await act(async () => {
    await expect(result.current.write(input)).rejects.toThrow("Response lost");
  });
  await waitFor(() => expect(result.current.mutation.variables?.input).toBe(input));
  act(() => {
    client.setQueryData(
      partnersKeys.adminReviewQueue(ADMIN_USER_A, null, 20, result.current.session.epoch),
      { pages: [{ items: [] }] },
    );
  });
  expect(result.current.mutation.variables?.input).toBe(input);
  await act(async () => {
    expect(await result.current.write(input)).toEqual(confirmed);
  });
  const calls = jest.mocked(requestReferralRejection).mock.calls;
  expect(calls).toHaveLength(2);
  expect(calls[0][0].idempotencyKey).toBe(calls[1][0].idempotencyKey);
  for (const [request] of calls)
    expect(request).toEqual(
      expect.objectContaining({
        referralId: input.referralId,
        command: input.command,
        accessToken: "private-A",
      }),
    );
  const raw =
    sessionStorage.getItem(
      `powip:partners:admin-command:referral.reject:${ADMIN_PARTNER_ID}:${ADMIN_USER_A}`,
    ) ?? "";
  expect(raw).not.toContain("Private rejection reason");
  expect(raw).not.toContain("private-A");
  expect(JSON.parse(raw).entries).toHaveLength(1);
});

it("invalidates real read facts only after an acknowledged rejection or conflict", async () => {
  const { result } = renderHook(() => useReferralRejection(), { wrapper: wrapper() });
  const invalidate = jest.spyOn(client, "invalidateQueries");
  await act(async () => {
    await result.current.write(input);
  });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: partnersKeys.adminRead(ADMIN_USER_A) });
  invalidate.mockClear();
  jest.mocked(requestReferralRejection).mockRejectedValueOnce(buildAxiosError(409));
  await act(async () => {
    await expect(result.current.write(input)).rejects.toBeDefined();
  });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: partnersKeys.adminRead(ADMIN_USER_A) });
});

it("403 broadcasts resolution withdrawal without revoking separate VIEW or other capabilities", async () => {
  jest.mocked(requestReferralRejection).mockRejectedValueOnce(buildAxiosError(403));
  const { result } = renderHook(
    () => ({ one: useReferralRejection(), two: useReferralRejection() }),
    { wrapper: wrapper() },
  );
  await act(async () => {
    await expect(result.current.one.write(input)).rejects.toBeInstanceOf(CancelledError);
  });
  await waitFor(() => expect(result.current.two.session.enabled).toBe(false));
  expect(
    getAdminCapabilityDenial("reviews", ADMIN_USER_A, result.current.two.session.epoch),
  ).toBeTruthy();
  expect(
    getAdminCapabilityDenial("partners", ADMIN_USER_A, result.current.two.session.epoch),
  ).toBeNull();
});

it("shared external 401 cancels pending rejection and removes its family cache with no callback", async () => {
  const pending = deferred<typeof confirmed>();
  jest.mocked(requestReferralRejection).mockReturnValue(pending.promise);
  const { result } = renderHook(() => useReferralRejection(), { wrapper: wrapper() });
  const familyKey = result.current.session.familyKey;
  client.setQueryData([...familyKey, "private"], "Private result");
  let outcome: Promise<unknown> | undefined;
  act(() => {
    outcome = result.current.write(input).catch((failure) => failure);
  });
  await waitFor(() => expect(requestReferralRejection).toHaveBeenCalledTimes(1));
  const signal = jest.mocked(requestReferralRejection).mock.calls[0][0].signal;
  act(() => denyAdminReadSession(ADMIN_USER_A, "private-A", buildAxiosError(401)));
  await waitFor(() => expect(signal?.aborted).toBe(true));
  expect(client.getQueryData([...familyKey, "private"])).toBeUndefined();
  await act(async () => {
    pending.resolve(confirmed);
    expect(await outcome).toBeInstanceOf(CancelledError);
  });
});

it("identity change aborts old transport and cannot return success to a callback of the next session", async () => {
  const pending = deferred<typeof confirmed>();
  jest.mocked(requestReferralRejection).mockReturnValue(pending.promise);
  const { result, rerender } = renderHook(() => useReferralRejection(), { wrapper: wrapper() });
  let outcome: Promise<unknown> | undefined;
  act(() => {
    outcome = result.current.write(input).catch((failure) => failure);
  });
  await waitFor(() => expect(requestReferralRejection).toHaveBeenCalledTimes(1));
  const signal = jest.mocked(requestReferralRejection).mock.calls[0][0].signal;
  mockAuth = {
    user: { id: ADMIN_USER_B, permissions: ["PARTNERS_RESOLVE_REFERRAL"] },
    accessToken: "private-B",
  };
  tokenStore.set("private-B");
  rerender();
  expect(signal?.aborted).toBe(true);
  expect(result.current.mutationForSession).toBe(false);
  await act(async () => {
    pending.resolve(confirmed);
    expect(await outcome).toBeInstanceOf(CancelledError);
  });
});

it("permission withdrawal without token change immediately aborts pending dispatch", async () => {
  const pending = deferred<typeof confirmed>();
  jest.mocked(requestReferralRejection).mockReturnValue(pending.promise);
  const { result, rerender } = renderHook(() => useReferralRejection(), { wrapper: wrapper() });
  let outcome: Promise<unknown> | undefined;
  act(() => {
    outcome = result.current.write(input).catch((failure) => failure);
  });
  await waitFor(() => expect(requestReferralRejection).toHaveBeenCalledTimes(1));
  const signal = jest.mocked(requestReferralRejection).mock.calls[0][0].signal;
  if (mockAuth)
    mockAuth = { ...mockAuth, user: { ...mockAuth.user, permissions: ["PARTNERS_VIEW"] } };
  rerender();
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    pending.resolve(confirmed);
    expect(await outcome).toBeInstanceOf(CancelledError);
  });
});

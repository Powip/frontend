import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { CancelledError, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { tokenStore } from "@/lib/tokenStore";
import { requestAdminPartnerStatus } from "../../api/admin-partner-status.api";
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
import { clearAdminReadDenial } from "../../utils/admin-read-session-state";
import { useAdminPartnerStatus } from "../use-admin-partner-status";

let mockAuth: {
  user: { id: string; permissions: string[]; email?: string };
  accessToken: string;
} | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("../../api/admin-partner-status.api", () => ({ requestAdminPartnerStatus: jest.fn() }));
const input = {
  partnerId: ADMIN_PARTNER_ID,
  operation: "suspend" as const,
  command: { expectedVersion: 4, reason: "Protected reason" },
};
const resultValue = {
  id: ADMIN_PARTNER_ID,
  status: "SUSPENDED" as const,
  version: 5,
  updatedAt: "2026-10-11T10:00:00Z",
};
let client: QueryClient;
function wrapper() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
function deferred<T>() {
  let resolve!: (result: T) => void;
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
    user: { id: ADMIN_USER_A, permissions: ["PARTNERS_VIEW", "PARTNERS_MANAGE_PARTNERS"] },
    accessToken: "private-A",
  };
  tokenStore.set(mockAuth.accessToken);
  jest.mocked(requestAdminPartnerStatus).mockReset().mockResolvedValue(resultValue);
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
  null,
  {
    user: {
      id: ADMIN_USER_A,
      permissions: ["PARTNERS_VIEW", "PARTNERS_APPROVE"],
      email: "staff@example.test",
    },
    accessToken: "private-A",
  },
])("requires the dedicated capability before resolving a key or dispatching: %#", async (auth) => {
  mockAuth = auth;
  const { result } = renderHook(() => useAdminPartnerStatus(), { wrapper: wrapper() });
  expect(result.current.session.enabled).toBe(false);
  await act(async () => {
    await expect(
      result.current.mutation.mutateAsync({ input, epoch: result.current.session.epoch }),
    ).rejects.toBeInstanceOf(CancelledError);
  });
  expect(requestAdminPartnerStatus).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
});

it.each(["suspend", "resume"] as const)(
  "retains the original %s command/key after a lost response and background GET without storing private data",
  async (operation) => {
    const original = { ...input, operation };
    const confirmed = {
      ...resultValue,
      status: operation === "suspend" ? ("SUSPENDED" as const) : ("ACTIVE" as const),
    };
    jest
      .mocked(requestAdminPartnerStatus)
      .mockRejectedValueOnce(new Error("Response lost after commit"))
      .mockResolvedValue(confirmed);
    const { result } = renderHook(() => useAdminPartnerStatus(), { wrapper: wrapper() });
    await act(async () => {
      await expect(
        result.current.mutation.mutateAsync({
          input: original,
          epoch: result.current.session.epoch,
        }),
      ).rejects.toThrow("Response lost");
    });
    // A real detail read may already see the committed status. It must not replace mutation input.
    client.setQueryData(
      partnersKeys.adminPartner(ADMIN_PARTNER_ID, ADMIN_USER_A, result.current.session.epoch),
      confirmed,
    );
    await waitFor(() => expect(result.current.mutation.variables?.input).toBe(original));
    const retainedProposal = result.current.mutation.variables?.input;
    if (!retainedProposal) throw new Error("Expected the original proposal to remain available");
    await act(async () => {
      await result.current.mutation.mutateAsync({
        input: retainedProposal,
        epoch: result.current.session.epoch,
      });
    });
    const calls = jest.mocked(requestAdminPartnerStatus).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0].idempotencyKey).toBe(calls[1][0].idempotencyKey);
    expect(calls[0][0]).toEqual(expect.objectContaining({ ...original, accessToken: "private-A" }));
    expect(calls[1][0]).toEqual(expect.objectContaining({ ...original, accessToken: "private-A" }));
    const saved =
      sessionStorage.getItem(
        `powip:partners:admin-command:partner.${operation}:${ADMIN_PARTNER_ID}:${ADMIN_USER_A}`,
      ) ?? "";
    expect(saved).not.toContain("Protected reason");
    expect(saved).not.toContain("private-A");
    expect(JSON.parse(saved).entries).toHaveLength(1);
  },
);

it("refreshes actual admin facts after confirmation or conflict without an optimistic status", async () => {
  const { result } = renderHook(() => useAdminPartnerStatus(), { wrapper: wrapper() });
  const existing = { status: "ACTIVE", version: 4 };
  client.setQueryData(
    partnersKeys.adminPartner(ADMIN_PARTNER_ID, ADMIN_USER_A, result.current.session.epoch),
    existing,
  );
  const invalidate = jest.spyOn(client, "invalidateQueries");
  await act(async () => {
    await result.current.mutation.mutateAsync({ input, epoch: result.current.session.epoch });
  });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: partnersKeys.adminRead(ADMIN_USER_A) });
  expect(
    client.getQueryData(
      partnersKeys.adminPartner(ADMIN_PARTNER_ID, ADMIN_USER_A, result.current.session.epoch),
    ),
  ).toEqual(existing);
  invalidate.mockClear();
  jest.mocked(requestAdminPartnerStatus).mockRejectedValueOnce(buildAxiosError(409));
  await act(async () => {
    await expect(
      result.current.mutation.mutateAsync({ input, epoch: result.current.session.epoch }),
    ).rejects.toBeDefined();
  });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: partnersKeys.adminRead(ADMIN_USER_A) });
});

it("broadcasts withdrawn management capability across status controls while leaving VIEW separate", async () => {
  const { result } = renderHook(
    () => ({ first: useAdminPartnerStatus(), second: useAdminPartnerStatus() }),
    { wrapper: wrapper() },
  );
  jest.mocked(requestAdminPartnerStatus).mockRejectedValueOnce(buildAxiosError(403));
  await act(async () => {
    await expect(
      result.current.first.mutation.mutateAsync({
        input,
        epoch: result.current.first.session.epoch,
      }),
    ).rejects.toBeDefined();
  });
  await waitFor(() => expect(result.current.second.session.enabled).toBe(false));
  expect(
    getAdminCapabilityDenial("partners", ADMIN_USER_A, result.current.first.session.epoch),
  ).toBeTruthy();
  expect(
    getAdminCapabilityDenial("resources", ADMIN_USER_A, result.current.first.session.epoch),
  ).toBeNull();
  expect(
    getAdminCapabilityDenial("policy", ADMIN_USER_A, result.current.first.session.epoch),
  ).toBeNull();
});

it("aborts an old actor request and ignores its late response or invalidation after account change", async () => {
  const pending = deferred<typeof resultValue>();
  jest.mocked(requestAdminPartnerStatus).mockReturnValueOnce(pending.promise);
  const { result, rerender } = renderHook(() => useAdminPartnerStatus(), { wrapper: wrapper() });
  const invalidate = jest.spyOn(client, "invalidateQueries");
  let completion!: Promise<unknown>;
  act(() => {
    completion = result.current.mutation
      .mutateAsync({ input, epoch: result.current.session.epoch })
      .catch((failure) => failure);
  });
  await waitFor(() => expect(requestAdminPartnerStatus).toHaveBeenCalledTimes(1));
  const signal = jest.mocked(requestAdminPartnerStatus).mock.calls[0][0].signal;
  mockAuth = {
    user: { id: ADMIN_USER_B, permissions: ["PARTNERS_MANAGE_PARTNERS"] },
    accessToken: "private-B",
  };
  tokenStore.set(mockAuth.accessToken);
  rerender();
  expect(signal?.aborted).toBe(true);
  expect(result.current.mutationForSession).toBe(false);
  await act(async () => {
    pending.resolve(resultValue);
    expect(await completion).toBeInstanceOf(CancelledError);
  });
  expect(invalidate).not.toHaveBeenCalled();
  expect(result.current.mutationForSession).toBe(false);
});

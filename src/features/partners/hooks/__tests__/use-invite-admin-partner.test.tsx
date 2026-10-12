import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { CancelledError, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { tokenStore } from "@/lib/tokenStore";
import { requestCreateInvitation, requestResendInvitation } from "../../api/admin-invitations.api";
import { ADMIN_USER_A, ADMIN_USER_B } from "../../test-utils/admin-partners.fixture";
import { buildAxiosError } from "../../test-utils/axios-error";
import {
  clearAdminCapabilityDenials,
  getAdminCapabilityDenial,
} from "../../utils/admin-capability-session-state";
import { clearAdminReadDenial } from "../../utils/admin-read-session-state";
import { useInviteAdminPartner, type InvitationWriteInput } from "../use-invite-admin-partner";
let mockAuth: { user: { id: string; permissions: string[] }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("../../api/admin-invitations.api", () => ({
  requestCreateInvitation: jest.fn(),
  requestResendInvitation: jest.fn(),
}));
const id = "33333333-3333-4333-8333-333333333333";
const form = { name: "Protected name", email: "private@example.test", profile: "dev" as const };
const create: InvitationWriteInput = { operation: "create", form };
const resend: InvitationWriteInput = {
  operation: "resend",
  invitationId: id,
  command: { reason: "Protected reason" },
};
const receipt = { invitationId: id, state: "QUEUED" as const, createdAt: "2026-10-12T00:00:00Z" };
let client: QueryClient;
function wrapper() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
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
  mockAuth = {
    user: { id: ADMIN_USER_A, permissions: ["PARTNERS_VIEW", "PARTNERS_APPROVE"] },
    accessToken: "private-A",
  };
  tokenStore.set(mockAuth.accessToken);
  jest.mocked(requestCreateInvitation).mockReset().mockResolvedValue(receipt);
  jest
    .mocked(requestResendInvitation)
    .mockReset()
    .mockResolvedValue({ invitationId: id, state: "QUEUED", queuedAt: receipt.createdAt });
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
    user: { id: ADMIN_USER_A, permissions: ["PARTNERS_VIEW", "PARTNERS_MANAGE_PARTNERS"] },
    accessToken: "private-A",
  },
])("requires APPROVE; VIEW or management does not invite: %#", async (auth) => {
  mockAuth = auth;
  const { result } = renderHook(() => useInviteAdminPartner(), { wrapper: wrapper() });
  await act(async () => {
    await expect(
      result.current.mutation.mutateAsync({ input: create, epoch: result.current.session.epoch }),
    ).rejects.toBeInstanceOf(CancelledError);
  });
  expect(requestCreateInvitation).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
});
it.each([create, resend])(
  "retains command/key after uncertain outcome without storing PII: %#",
  async (input) => {
    const api =
      input.operation === "create"
        ? jest.mocked(requestCreateInvitation)
        : jest.mocked(requestResendInvitation);
    api.mockRejectedValueOnce(new Error("Response lost"));
    const { result } = renderHook(() => useInviteAdminPartner(), { wrapper: wrapper() });
    await act(async () => {
      await expect(
        result.current.mutation.mutateAsync({ input, epoch: result.current.session.epoch }),
      ).rejects.toThrow("Response lost");
    });
    await act(async () => {
      await result.current.mutation.mutateAsync({ input, epoch: result.current.session.epoch });
    });
    expect(api).toHaveBeenCalledTimes(2);
    expect(api.mock.calls[0][0].idempotencyKey).toBe(api.mock.calls[1][0].idempotencyKey);
    expect(api.mock.calls[0][0].accessToken).toBe("private-A");
    const stored = Array.from({ length: sessionStorage.length }, (_, i) =>
      sessionStorage.getItem(sessionStorage.key(i) as string),
    ).join("");
    for (const secret of [form.name, form.email, "Protected reason", "private-A"])
      expect(stored).not.toContain(secret);
  },
);
it("denies invitation writes on403 while keeping read/other capabilities distinct", async () => {
  const { result } = renderHook(
    () => ({ first: useInviteAdminPartner(), second: useInviteAdminPartner() }),
    { wrapper: wrapper() },
  );
  jest.mocked(requestCreateInvitation).mockRejectedValueOnce(buildAxiosError(403));
  await act(async () => {
    await expect(
      result.current.first.mutation.mutateAsync({
        input: create,
        epoch: result.current.first.session.epoch,
      }),
    ).rejects.toBeDefined();
  });
  await waitFor(() => expect(result.current.second.session.enabled).toBe(false));
  expect(
    getAdminCapabilityDenial("invitations", ADMIN_USER_A, result.current.first.session.epoch),
  ).toBeTruthy();
  expect(
    getAdminCapabilityDenial("partners", ADMIN_USER_A, result.current.first.session.epoch),
  ).toBeNull();
});
it("aborts old session and ignores late confirmation without invalidating next user's data", async () => {
  let resolve!: (value: typeof receipt) => void;
  const delayed = new Promise<typeof receipt>((accept) => {
    resolve = accept;
  });
  jest.mocked(requestCreateInvitation).mockReturnValueOnce(delayed);
  const { result, rerender } = renderHook(() => useInviteAdminPartner(), { wrapper: wrapper() });
  const invalidate = jest.spyOn(client, "invalidateQueries");
  let completion!: Promise<unknown>;
  act(() => {
    completion = result.current.mutation
      .mutateAsync({ input: create, epoch: result.current.session.epoch })
      .catch((failure) => failure);
  });
  await waitFor(() => expect(requestCreateInvitation).toHaveBeenCalledTimes(1));
  const signal = jest.mocked(requestCreateInvitation).mock.calls[0][0].signal;
  mockAuth = {
    user: { id: ADMIN_USER_B, permissions: ["PARTNERS_VIEW", "PARTNERS_APPROVE"] },
    accessToken: "private-B",
  };
  tokenStore.set(mockAuth.accessToken);
  rerender();
  expect(signal?.aborted).toBe(true);
  expect(result.current.mutationForSession).toBe(false);
  await act(async () => {
    resolve(receipt);
    expect(await completion).toBeInstanceOf(CancelledError);
  });
  expect(invalidate).not.toHaveBeenCalled();
});
it("ignores late401 from actorA without denying actorB", async () => {
  let reject!: (value: unknown) => void;
  jest.mocked(requestCreateInvitation).mockReturnValueOnce(
    new Promise((_accept, fail) => {
      reject = fail;
    }),
  );
  const { result, rerender } = renderHook(() => useInviteAdminPartner(), { wrapper: wrapper() });
  let completion!: Promise<unknown>;
  act(() => {
    completion = result.current.mutation
      .mutateAsync({ input: create, epoch: result.current.session.epoch })
      .catch((failure) => failure);
  });
  await waitFor(() => expect(requestCreateInvitation).toHaveBeenCalledTimes(1));
  mockAuth = {
    user: { id: ADMIN_USER_B, permissions: ["PARTNERS_VIEW", "PARTNERS_APPROVE"] },
    accessToken: "private-B",
  };
  tokenStore.set(mockAuth.accessToken);
  rerender();
  await act(async () => {
    reject(buildAxiosError(401));
    expect(await completion).toBeInstanceOf(CancelledError);
  });
  expect(result.current.session.enabled).toBe(true);
  expect(
    getAdminCapabilityDenial("invitations", ADMIN_USER_B, result.current.session.epoch),
  ).toBeNull();
});

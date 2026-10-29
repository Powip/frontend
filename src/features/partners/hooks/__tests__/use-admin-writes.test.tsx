import { CancelledError, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { tokenStore } from "@/lib/tokenStore";
import {
  requestAdminCommissionPolicyVersions,
  requestCreateAdminCommissionPolicyDraft,
} from "../../api/admin-commission-policy.api";
import {
  requestAdminResources,
  requestCreateAdminResource,
  requestReviseAdminResource,
  requestTransitionAdminResource,
} from "../../api/admin-resources.api";
import {
  adminResource,
  POLICY_COMMAND,
  policyDraft,
  RESOURCE_COMMAND,
  WRITE_USER_A,
  WRITE_USER_B,
} from "../../test-utils/admin-writes.fixture";
import { buildAxiosError } from "../../test-utils/axios-error";
import { clearAdminCapabilityDenials } from "../../utils/admin-capability-session-state";
import { resolveAdminCommandIdempotencyKey } from "../../utils/admin-command-idempotency";
import { useAdminCommissionPolicies } from "../use-admin-commission-policies";
import { useAdminResources } from "../use-admin-resources";
import { useAdminReadAccess, useAdminReadSession } from "../use-admin-read-session";
import { clearAdminReadDenial, denyAdminReadSession } from "../../utils/admin-read-session-state";

let mockAuth: {
  user: { id: string; permissions: string[]; email?: string };
  accessToken: string;
} | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("../../api/admin-commission-policy.api", () => ({
  requestAdminCommissionPolicyVersions: jest.fn(),
  requestCreateAdminCommissionPolicyDraft: jest.fn(),
}));
jest.mock("../../api/admin-resources.api", () => ({
  requestAdminResources: jest.fn(),
  requestCreateAdminResource: jest.fn(),
  requestReviseAdminResource: jest.fn(),
  requestTransitionAdminResource: jest.fn(),
}));
jest.mock("../../utils/admin-command-idempotency", () => ({
  resolveAdminCommandIdempotencyKey: jest.fn(),
}));
let client: QueryClient;
function wrapper() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300_000 } } });
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
function deferred<T>() {
  let resolve!: (result: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const policyPage = () => ({ items: [policyDraft()], nextCursor: null });
const resourcePage = () => ({
  items: [adminResource()],
  nextCursor: null,
  hasMore: false,
  limit: 20,
});
beforeEach(() => {
  clearAdminCapabilityDenials();
  clearAdminReadDenial();
  mockAuth = {
    user: {
      id: WRITE_USER_A,
      permissions: ["PARTNERS_VIEW", "PARTNERS_CONFIGURE_POLICY", "PARTNERS_MANAGE_RESOURCES"],
    },
    accessToken: "bearer-A-private",
  };
  tokenStore.set(mockAuth.accessToken);
  jest.mocked(requestAdminCommissionPolicyVersions).mockReset().mockResolvedValue(policyPage());
  jest.mocked(requestAdminResources).mockReset().mockResolvedValue(resourcePage());
  jest.mocked(requestCreateAdminCommissionPolicyDraft).mockReset().mockResolvedValue(policyDraft());
  jest.mocked(requestCreateAdminResource).mockReset().mockResolvedValue(adminResource());
  jest
    .mocked(requestReviseAdminResource)
    .mockReset()
    .mockResolvedValue(adminResource({ version: 1 }));
  jest
    .mocked(requestTransitionAdminResource)
    .mockReset()
    .mockResolvedValue(adminResource({ state: "PUBLISHED", version: 1 }));
  jest
    .mocked(resolveAdminCommandIdempotencyKey)
    .mockReset()
    .mockResolvedValue("stable-retry-key-123");
});
afterEach(() => {
  cleanup();
  client?.clear();
  tokenStore.set(null);
  clearAdminCapabilityDenials();
  clearAdminReadDenial();
});

it.each([
  null,
  {
    user: { id: WRITE_USER_A, permissions: ["PARTNERS_VIEW"], email: "tognolimauricio@gmail.com" },
    accessToken: "bearer-A-private",
  },
])("requires the explicit dedicated capability rather than VIEW/email: %#", async (auth) => {
  mockAuth = auth;
  const { result } = renderHook(
    () => ({ policy: useAdminCommissionPolicies(), resources: useAdminResources() }),
    { wrapper: wrapper() },
  );
  expect(result.current.policy.session.enabled).toBe(false);
  expect(result.current.resources.session.enabled).toBe(false);
  await expect(
    result.current.policy.creation.mutateAsync({
      command: POLICY_COMMAND,
      epoch: result.current.policy.session.epoch,
    }),
  ).rejects.toBeInstanceOf(CancelledError);
  expect(requestAdminCommissionPolicyVersions).not.toHaveBeenCalled();
  expect(requestAdminResources).not.toHaveBeenCalled();
  expect(requestCreateAdminCommissionPolicyDraft).not.toHaveBeenCalled();
});

it("keeps page cursors real and isolates fresh same-user bearer caches without token keys", async () => {
  jest
    .mocked(requestAdminCommissionPolicyVersions)
    .mockResolvedValueOnce({ ...policyPage(), nextCursor: "policy-next" });
  const { result, rerender } = renderHook(() => useAdminCommissionPolicies(2), {
    wrapper: wrapper(),
  });
  await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
  await act(async () => {
    await result.current.query.fetchNextPage();
  });
  expect(requestAdminCommissionPolicyVersions).toHaveBeenLastCalledWith(
    expect.objectContaining({ cursor: "policy-next", limit: 2, accessToken: "bearer-A-private" }),
  );
  const pendingB = deferred<ReturnType<typeof policyPage>>();
  jest.mocked(requestAdminCommissionPolicyVersions).mockReturnValueOnce(pendingB.promise);
  mockAuth = { user: { id: WRITE_USER_A, permissions: ["PARTNERS_CONFIGURE_POLICY"] }, accessToken: "bearer-B-private" };
  tokenStore.set(mockAuth.accessToken);
  rerender();
  expect(result.current.query.data).toBeUndefined();
  await act(async () => pendingB.resolve({ items: [], nextCursor: null }));
  await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
  expect(
    JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey),
    ),
  ).not.toContain("bearer-");
});

it("reuses the command retry key after an unknown policy result without changing rates", async () => {
  jest
    .mocked(requestCreateAdminCommissionPolicyDraft)
    .mockRejectedValueOnce(new Error("timeout after persistence"));
  const { result } = renderHook(() => useAdminCommissionPolicies(), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
  const submit = () =>
    result.current.creation.mutateAsync({
      command: POLICY_COMMAND,
      epoch: result.current.session.epoch,
    });
  await act(async () => {
    await expect(submit()).rejects.toThrow("timeout");
  });
  await act(async () => {
    await submit();
  });
  const calls = jest.mocked(requestCreateAdminCommissionPolicyDraft).mock.calls;
  expect(calls).toHaveLength(2);
  expect(
    calls.every(
      ([request]) =>
        request.idempotencyKey === "stable-retry-key-123" &&
        request.command.firstPaymentRate === "0.1234567890",
    ),
  ).toBe(true);
  expect(resolveAdminCommandIdempotencyKey).toHaveBeenCalledWith(
    WRITE_USER_A,
    "commission-policy.create-draft",
    POLICY_COMMAND,
  );
});

it("broadcasts policy denial to other subscribers and purges that family without denying resources", async () => {
  const { result } = renderHook(
    () => ({
      list: useAdminCommissionPolicies(),
      form: useAdminCommissionPolicies(),
      resources: useAdminResources(),
    }),
    { wrapper: wrapper() },
  );
  await waitFor(() =>
    expect(result.current.list.query.isSuccess && result.current.resources.query.isSuccess).toBe(
      true,
    ),
  );
  const denied = buildAxiosError(403);
  jest.mocked(requestCreateAdminCommissionPolicyDraft).mockRejectedValueOnce(denied);
  await act(async () => {
    await expect(
      result.current.form.creation.mutateAsync({
        command: POLICY_COMMAND,
        epoch: result.current.form.session.epoch,
      }),
    ).rejects.toBe(denied);
  });
  await waitFor(() => expect(result.current.list.session.denied).toBe(denied));
  expect(result.current.form.session.denied).toBe(denied);
  expect(result.current.list.query.data).toBeUndefined();
  expect(result.current.list.session.enabled).toBe(false);
  expect(result.current.resources.session.denied).toBeNull();
  expect(result.current.resources.query.data?.pages[0].items).toEqual([adminResource()]);
});

it("pins policy dispatch while hashing and never dispatches under a replacement identity", async () => {
  const pendingKey = deferred<string>();
  jest.mocked(resolveAdminCommandIdempotencyKey).mockReturnValueOnce(pendingKey.promise);
  const { result, rerender } = renderHook(() => useAdminCommissionPolicies(), {
    wrapper: wrapper(),
  });
  let attempt!: Promise<unknown>;
  await act(async () => {
    attempt = result.current.creation.mutateAsync({
      command: POLICY_COMMAND,
      epoch: result.current.session.epoch,
    });
    await Promise.resolve();
  });
  mockAuth = {
    user: { id: WRITE_USER_B, permissions: ["PARTNERS_CONFIGURE_POLICY"] },
    accessToken: "bearer-B-private",
  };
  tokenStore.set(mockAuth.accessToken);
  rerender();
  await act(async () => {
    pendingKey.resolve("stable-retry-key-123");
    await expect(attempt).rejects.toBeInstanceOf(CancelledError);
  });
  expect(requestCreateAdminCommissionPolicyDraft).not.toHaveBeenCalled();
});

it("discards an old mutation success after the same actor refreshes to B", async () => {
  const pending = deferred<ReturnType<typeof policyDraft>>();
  jest.mocked(requestCreateAdminCommissionPolicyDraft).mockReturnValueOnce(pending.promise);
  const { result, rerender } = renderHook(() => useAdminCommissionPolicies(), {
    wrapper: wrapper(),
  });
  let attempt!: Promise<unknown>;
  await act(async () => {
    attempt = result.current.creation.mutateAsync({
      command: POLICY_COMMAND,
      epoch: result.current.session.epoch,
    });
    await Promise.resolve();
  });
  await waitFor(() => expect(requestCreateAdminCommissionPolicyDraft).toHaveBeenCalled());
  const firstSignal = jest.mocked(requestCreateAdminCommissionPolicyDraft).mock.calls[0][0].signal;
  mockAuth = { user: { id: WRITE_USER_A, permissions: ["PARTNERS_CONFIGURE_POLICY"] }, accessToken: "bearer-B-private" };
  tokenStore.set(mockAuth.accessToken);
  rerender();
  expect(firstSignal?.aborted).toBe(true);
  await act(async () => {
    pending.resolve(policyDraft());
    await expect(attempt).rejects.toBeInstanceOf(CancelledError);
  });
  expect(result.current.creationForSession).toBe(false);
  expect(result.current.session.denied).toBeNull();
});

it.each([401, 403])("discards stale %i before auth rerender rather than poisoning the new bearer", async (status) => {
  const pending = deferred<ReturnType<typeof policyDraft>>();
  jest.mocked(requestCreateAdminCommissionPolicyDraft).mockReturnValueOnce(pending.promise);
  const { result, rerender } = renderHook(() => useAdminCommissionPolicies(), {
    wrapper: wrapper(),
  });
  let attempt!: Promise<unknown>;
  await act(async () => {
    attempt = result.current.creation.mutateAsync({
      command: POLICY_COMMAND,
      epoch: result.current.session.epoch,
    });
    await Promise.resolve();
  });
  await waitFor(() => expect(requestCreateAdminCommissionPolicyDraft).toHaveBeenCalled());
  tokenStore.set("bearer-B-private");
  await act(async () => {
    pending.reject(buildAxiosError(status));
    await expect(attempt).rejects.toBeInstanceOf(CancelledError);
  });
  mockAuth = { user: { id: WRITE_USER_A, permissions: ["PARTNERS_CONFIGURE_POLICY"] }, accessToken: "bearer-B-private" };
  rerender();
  await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
  expect(result.current.session.denied).toBeNull();
});

it("broadcasts current resources401 across VIEW/policy/resources and recovers only on fresh bearer", async () => {
  const { result, rerender } = renderHook(() => ({ view: useAdminReadAccess(), policy: useAdminCommissionPolicies(), resources: useAdminResources() }), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.policy.query.isSuccess && result.current.resources.query.isSuccess).toBe(true));
  const expired = buildAxiosError(401);
  jest.mocked(requestCreateAdminResource).mockRejectedValueOnce(expired);
  await act(async () => { await expect(result.current.resources.mutation.mutateAsync({ input: { operation: "create", command: RESOURCE_COMMAND }, epoch: result.current.resources.session.epoch })).rejects.toBe(expired); });
  await waitFor(() => expect(result.current.view.denied).toBe(expired));
  expect(result.current.policy.session.denied).toBe(expired);
  expect(result.current.resources.session.denied).toBe(expired);
  expect(result.current.policy.query.data).toBeUndefined();
  expect(result.current.resources.query.data).toBeUndefined();
  mockAuth = { user: { id: WRITE_USER_A, permissions: ["PARTNERS_VIEW", "PARTNERS_CONFIGURE_POLICY", "PARTNERS_MANAGE_RESOURCES"] }, accessToken: "bearer-B-private" };
  tokenStore.set(mockAuth.accessToken); rerender();
  await waitFor(() => expect(result.current.policy.query.isSuccess && result.current.resources.query.isSuccess).toBe(true));
  expect(result.current.view.denied).toBeNull();
  expect(result.current.policy.session.denied).toBeNull();
});

it("inherits existing VIEW401 but never lets VIEW403 deny the independent write capabilities", async () => {
  const { result } = renderHook(() => ({ view: useAdminReadSession(), policy: useAdminCommissionPolicies(), resources: useAdminResources() }), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.policy.query.isSuccess && result.current.resources.query.isSuccess).toBe(true));
  await act(async () => { denyAdminReadSession(WRITE_USER_A, "bearer-A-private", buildAxiosError(403)); });
  expect(result.current.policy.session.enabled).toBe(true);
  expect(result.current.resources.session.enabled).toBe(true);
  act(() => clearAdminReadDenial());
  const expired = buildAxiosError(401);
  await act(async () => { await expect(result.current.view.read(new AbortController().signal, async () => { throw expired; })).rejects.toBe(expired); });
  await waitFor(() => expect(result.current.policy.session.denied).toBe(expired));
  expect(result.current.resources.session.denied).toBe(expired);
  expect(result.current.policy.query.data).toBeUndefined();
  expect(result.current.resources.query.data).toBeUndefined();
});

it("resource writes bind expected version and target operation without silently retrying a conflict", async () => {
  const { result } = renderHook(() => useAdminResources(), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
  const resource = adminResource();
  await act(async () => {
    await result.current.mutation.mutateAsync({
      input: {
        operation: "revise",
        resourceId: resource.id,
        command: { ...RESOURCE_COMMAND, expectedVersion: 0 },
      },
      epoch: result.current.session.epoch,
    });
  });
  expect(requestReviseAdminResource).toHaveBeenCalledWith(
    expect.objectContaining({
      resourceId: resource.id,
      command: { ...RESOURCE_COMMAND, expectedVersion: 0 },
      accessToken: "bearer-A-private",
      idempotencyKey: "stable-retry-key-123",
    }),
  );
  const conflict = buildAxiosError(409, { code: "RESOURCE_VERSION_CONFLICT" });
  jest.mocked(requestTransitionAdminResource).mockRejectedValueOnce(conflict);
  await act(async () => {
    await expect(
      result.current.mutation.mutateAsync({
        input: {
          operation: "publish",
          resourceId: resource.id,
          command: { expectedVersion: 0, reason: "Test-only publish" },
        },
        epoch: result.current.session.epoch,
      }),
    ).rejects.toBe(conflict);
  });
  expect(requestTransitionAdminResource).toHaveBeenCalledTimes(1);
  expect(result.current.session.denied).toBeNull();
});

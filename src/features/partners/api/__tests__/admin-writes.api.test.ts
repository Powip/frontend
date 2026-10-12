import { AxiosError } from "axios";
import {
  adminResource,
  POLICY_COMMAND,
  policyDraft,
  RESOURCE_COMMAND,
} from "../../test-utils/admin-writes.fixture";
import {
  adminCommissionPolicyClient,
  requestAdminCommissionPolicyVersions,
  requestCreateAdminCommissionPolicyDraft,
} from "../admin-commission-policy.api";
import {
  adminResourcesClient,
  requestAdminResources,
  requestCreateAdminResource,
  requestReviseAdminResource,
  requestTransitionAdminResource,
} from "../admin-resources.api";

jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.review.invalid/v1/partners" },
}));
afterEach(() => jest.restoreAllMocks());

it("requests actual policy pagination and keeps exact decimal strings, nulls, token and retry key", async () => {
  const get = jest
    .spyOn(adminCommissionPolicyClient, "get")
    .mockResolvedValue({ data: { items: [policyDraft()], nextCursor: "opaque" } });
  const signal = new AbortController().signal;
  expect(
    await requestAdminCommissionPolicyVersions({
      accessToken: "A",
      cursor: "c+/=",
      limit: 2,
      signal,
    }),
  ).toEqual({ items: [policyDraft()], nextCursor: "opaque" });
  expect(get).toHaveBeenCalledWith(expect.stringContaining("/admin/commission-policy-versions"), {
    headers: { Authorization: "Bearer A" },
    signal,
    params: { cursor: "c+/=", limit: 2 },
  });
  const post = jest
    .spyOn(adminCommissionPolicyClient, "post")
    .mockResolvedValue({ data: policyDraft() });
  await requestCreateAdminCommissionPolicyDraft({
    accessToken: "A",
    command: POLICY_COMMAND,
    idempotencyKey: "retry-key-123",
    signal,
  });
  expect(post).toHaveBeenCalledWith(expect.any(String), POLICY_COMMAND, {
    headers: { Authorization: "Bearer A", "Idempotency-Key": "retry-key-123" },
    signal,
  });
});

it.each([
  { firstPaymentRate: 0.1 },
  { firstPaymentRate: "1.0000000001" },
  { recurringPaymentRate: "0.12345678901" },
  { recurringPaymentCount: 0 },
  { recurringPaymentCount: "2" },
  { effectiveFrom: "tomorrow" },
  { reason: "\0" },
  { reason: " " },
])("rejects invalid policy commands without dispatch %#", async (override) => {
  const post = jest.spyOn(adminCommissionPolicyClient, "post");
  await expect(
    requestCreateAdminCommissionPolicyDraft({
      accessToken: "A",
      command: { ...POLICY_COMMAND, ...override } as typeof POLICY_COMMAND,
      idempotencyKey: "retry-key-123",
    }),
  ).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
});

it.each([
  { state: "ACTIVE" },
  { firstPaymentRate: 0 },
  { recurringPaymentRate: null },
  { recurringPaymentCount: -1 },
  { id: "invalid" },
  { createdAt: "yesterday" },
  { plan: "Standard" },
])("rejects non-DRAFT, expanded or coerced policy responses %#", async (override) => {
  jest
    .spyOn(adminCommissionPolicyClient, "get")
    .mockResolvedValue({ data: { items: [{ ...policyDraft(), ...override }], nextCursor: null } });
  await expect(requestAdminCommissionPolicyVersions({ accessToken: "A" })).rejects.toThrow();
});

it("decodes real empty policy pages without invented pagination metadata", async () => {
  const get = jest
    .spyOn(adminCommissionPolicyClient, "get")
    .mockResolvedValue({ data: { items: [], nextCursor: null } });
  expect(await requestAdminCommissionPolicyVersions({ accessToken: "A" })).toEqual({
    items: [],
    nextCursor: null,
  });
  get.mockResolvedValueOnce({ data: { items: [], nextCursor: null, hasMore: false, limit: 50 } });
  await expect(requestAdminCommissionPolicyVersions({ accessToken: "A" })).rejects.toThrow();
});

it("uses actual resource CRUD endpoints, metadata, version, reason and idempotency headers", async () => {
  const resource = adminResource();
  const signal = new AbortController().signal;
  const get = jest
    .spyOn(adminResourcesClient, "get")
    .mockResolvedValue({
      data: { items: [resource], nextCursor: null, hasMore: false, limit: 20 },
    });
  await requestAdminResources({ accessToken: "A", limit: 20, signal });
  expect(get).toHaveBeenCalledWith(expect.stringContaining("/admin/resources"), {
    headers: { Authorization: "Bearer A" },
    signal,
    params: { limit: 20 },
  });
  const post = jest.spyOn(adminResourcesClient, "post").mockResolvedValue({ data: resource });
  const base = { accessToken: "A", idempotencyKey: "retry-key-123", signal };
  await requestCreateAdminResource({ ...base, command: RESOURCE_COMMAND });
  expect(post).toHaveBeenLastCalledWith(
    expect.stringContaining("/admin/resources"),
    RESOURCE_COMMAND,
    { headers: { Authorization: "Bearer A", "Idempotency-Key": "retry-key-123" }, signal },
  );
  const revised = { ...RESOURCE_COMMAND, expectedVersion: 0 };
  await requestReviseAdminResource({ ...base, resourceId: resource.id, command: revised });
  expect(post).toHaveBeenLastCalledWith(
    expect.stringContaining(`/${resource.id}/revise`),
    revised,
    expect.any(Object),
  );
  for (const transition of ["publish", "unpublish", "archive"] as const) {
    await requestTransitionAdminResource({
      ...base,
      resourceId: resource.id,
      transition,
      command: { expectedVersion: 0, reason: "Test-only transition" },
    });
    expect(post).toHaveBeenLastCalledWith(
      expect.stringContaining(`/${resource.id}/${transition}`),
      { expectedVersion: 0, reason: "Test-only transition" },
      expect.any(Object),
    );
  }
});

it.each([
  { version: "0" },
  { version: Number.MAX_SAFE_INTEGER + 1 },
  { sortOrder: 1.5 },
  { state: "ACTIVE" },
  { archivedAt: "2026-10-10T10:00:00Z" },
  { publicUrl: "javascript:alert(1)" },
  { publicUrl: "https://host.invalid/path?token=secret" },
  { publicUrl: "https://user:pass@host.invalid/path" },
  { publicUrl: "https://host.invalid/path#fragment" },
  { privateNote: "hidden" },
])("rejects malformed or unsafe resource responses %#", async (override) => {
  jest
    .spyOn(adminResourcesClient, "get")
    .mockResolvedValue({
      data: {
        items: [{ ...adminResource(), ...override }],
        nextCursor: null,
        hasMore: false,
        limit: 20,
      },
    });
  await expect(requestAdminResources({ accessToken: "A" })).rejects.toThrow();
});

it("keeps published resources with withdrawn links nullable rather than inventing a download", async () => {
  const resource = adminResource({ state: "PUBLISHED", publicUrl: null, version: 1 });
  jest.spyOn(adminResourcesClient, "post").mockResolvedValue({ data: resource });
  expect(
    await requestTransitionAdminResource({
      accessToken: "A",
      resourceId: resource.id,
      transition: "publish",
      command: { expectedVersion: 0, reason: "Test-only publish" },
      idempotencyKey: "retry-key-123",
    }),
  ).toEqual(resource);
});

it("accepts legitimate 2048-character resource URLs and rejects 2049 without breaking exact strings", async () => {
  const prefix = "https://resources.review.invalid/";
  const url = prefix + "a".repeat(2048 - prefix.length);
  const get = jest.spyOn(adminResourcesClient, "get").mockResolvedValue({ data: { items: [adminResource({ publicUrl: url })], nextCursor: null, hasMore: false, limit: 20 } });
  expect((await requestAdminResources({ accessToken: "A" })).items[0].publicUrl).toBe(url);
  get.mockResolvedValueOnce({ data: { items: [adminResource({ publicUrl: `${url}a` })], nextCursor: null, hasMore: false, limit: 20 } });
  await expect(requestAdminResources({ accessToken: "A" })).rejects.toThrow();
});

it("accepts legacy metadata newlines for read, but rejects C0/C1 controls in new commands", async () => {
  jest.spyOn(adminResourcesClient, "get").mockResolvedValue({ data: { items: [adminResource({ description: "Legacy\nmetadata" })], nextCursor: null, hasMore: false, limit: 20 } });
  expect((await requestAdminResources({ accessToken: "A" })).items[0].description).toBe("Legacy\nmetadata");
  const post = jest.spyOn(adminResourcesClient, "post");
  for (const description of ["New\nmetadata", "bad\u0085metadata", "bad\u007fmetadata"]) {
    await expect(requestCreateAdminResource({ accessToken: "A", command: { ...RESOURCE_COMMAND, description }, idempotencyKey: "retry-key-123" })).rejects.toThrow();
  }
  expect(post).not.toHaveBeenCalled();
});

it.each([401, 403, 404, 409, 503])(
  "preserves authoritative HTTP %i failures without success fallbacks",
  async (status) => {
    const error = new AxiosError("Service rejected", undefined, undefined, undefined, {
      status,
      data: { code: "TEST_ONLY" },
      statusText: "error",
      headers: {},
      config: {} as never,
    });
    jest.spyOn(adminCommissionPolicyClient, "post").mockRejectedValue(error);
    jest.spyOn(adminResourcesClient, "get").mockRejectedValue(error);
    await expect(
      requestCreateAdminCommissionPolicyDraft({
        accessToken: "A",
        command: POLICY_COMMAND,
        idempotencyKey: "retry-key-123",
      }),
    ).rejects.toBe(error);
    await expect(requestAdminResources({ accessToken: "A" })).rejects.toBe(error);
  },
);

import { ADMIN_PARTNER_ID, ADMIN_USER_A } from "../../test-utils/admin-partners.fixture";
import { adminPartnerStatusClient, requestAdminPartnerStatus } from "../admin-partner-status.api";

jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.review.invalid/v1/partners" },
}));
afterEach(() => jest.restoreAllMocks());
const command = { expectedVersion: 4, reason: "Protected reason" };
const confirmed = {
  id: ADMIN_PARTNER_ID,
  status: "SUSPENDED",
  version: 5,
  updatedAt: "2026-10-11T10:00:00Z",
};

it.each(["suspend", "resume"] as const)(
  "sends the explicit %s version and reason with captured bearer and key",
  async (operation) => {
    const status = operation === "suspend" ? "SUSPENDED" : "ACTIVE";
    const post = jest
      .spyOn(adminPartnerStatusClient, "post")
      .mockResolvedValue({ data: { ...confirmed, status } });
    const signal = new AbortController().signal;
    expect(
      await requestAdminPartnerStatus({
        accessToken: "captured-A",
        partnerId: ADMIN_PARTNER_ID,
        operation,
        command: { ...command, reason: " Protected reason " },
        idempotencyKey: "stable-key-123",
        signal,
      }),
    ).toEqual({ ...confirmed, status });
    expect(post).toHaveBeenCalledWith(
      `https://partners.review.invalid/v1/partners/admin/partners/${ADMIN_PARTNER_ID}/${operation}`,
      command,
      {
        signal,
        headers: { Authorization: "Bearer captured-A", "Idempotency-Key": "stable-key-123" },
      },
    );
  },
);

it.each([
  { expectedVersion: -1 },
  { expectedVersion: Number.MAX_SAFE_INTEGER + 1 },
  { expectedVersion: "4" },
  { expectedVersion: 4.1 },
  { reason: " " },
  { reason: "a".repeat(2001) },
  { reason: "a\nb" },
  { reason: null },
  { actorSubject: ADMIN_USER_A },
  { status: "ACTIVE" },
])("rejects invalid or expanded commands before dispatch: %#", async (override) => {
  const post = jest.spyOn(adminPartnerStatusClient, "post");
  await expect(
    requestAdminPartnerStatus({
      accessToken: "A",
      partnerId: ADMIN_PARTNER_ID,
      operation: "suspend",
      command: { ...command, ...override } as typeof command,
      idempotencyKey: "stable-key-123",
    }),
  ).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
});

it.each([
  { partnerId: "1-1-1-1-1" },
  { operation: "approve" },
  { idempotencyKey: "short" },
  { idempotencyKey: " key-with-space" },
  { idempotencyKey: "a".repeat(201) },
])("rejects unsafe target, operation or key before dispatch: %#", async (override) => {
  const post = jest.spyOn(adminPartnerStatusClient, "post");
  await expect(
    requestAdminPartnerStatus({
      accessToken: "A",
      partnerId: ADMIN_PARTNER_ID,
      operation: "suspend",
      command,
      idempotencyKey: "stable-key-123",
      ...override,
    } as Parameters<typeof requestAdminPartnerStatus>[0]),
  ).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
});

it.each([
  { id: ADMIN_USER_A },
  { version: undefined },
  { version: 6 },
  { version: "5" },
  { status: "ACTIVE" },
  { status: "APPLIED" },
  { updatedAt: "tomorrow" },
  { reason: "private" },
])("does not acknowledge a malformed or mismatched confirmation: %#", async (override) => {
  jest
    .spyOn(adminPartnerStatusClient, "post")
    .mockResolvedValue({ data: { ...confirmed, ...override } });
  await expect(
    requestAdminPartnerStatus({
      accessToken: "A",
      partnerId: ADMIN_PARTNER_ID,
      operation: "suspend",
      command,
      idempotencyKey: "stable-key-123",
    }),
  ).rejects.toThrow();
});

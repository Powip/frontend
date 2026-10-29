import { adminReviewQueuePageResponseSchema } from "../../schemas/admin-partners-response.schema";
import {
  ADMIN_PARTNER_ID,
  ADMIN_USER_A,
  ADMIN_USER_B,
} from "../../test-utils/admin-partners.fixture";
import { referralRejectionClient, requestReferralRejection } from "../referral-rejection.api";

jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.review.invalid/v1/partners" },
}));
afterEach(() => jest.restoreAllMocks());
const command = { expectedVersion: 4, reason: "Protected reason" };
const confirmed = {
  id: ADMIN_USER_A,
  partnerId: ADMIN_PARTNER_ID,
  origin: "MANUAL",
  state: "CANCELLED",
  decision: "REJECTED",
  version: 5,
  decidedAt: "2026-10-11T10:00:00Z",
};
const request = {
  accessToken: "captured-A",
  referralId: ADMIN_USER_A,
  command,
  idempotencyKey: "stable-key-123",
};

it("sends only bounded explicit version/reason using the pinned bearer and exact retry key", async () => {
  const post = jest.spyOn(referralRejectionClient, "post").mockResolvedValue({ data: confirmed });
  const signal = new AbortController().signal;
  expect(
    await requestReferralRejection({
      ...request,
      command: { ...command, reason: " Protected reason " },
      signal,
    }),
  ).toEqual(confirmed);
  expect(post).toHaveBeenCalledWith(
    `https://partners.review.invalid/v1/partners/admin/review-queue/${ADMIN_USER_A}/reject`,
    command,
    {
      signal,
      headers: { Authorization: "Bearer captured-A", "Idempotency-Key": "stable-key-123" },
    },
  );
});

it.each([
  { expectedVersion: -1 },
  { expectedVersion: Number.MAX_SAFE_INTEGER + 1 },
  { expectedVersion: "4" },
  { expectedVersion: 4.1 },
  { reason: " " },
  { reason: "a".repeat(1001) },
  { reason: "a\nb" },
  { reason: "a\u0085b" },
  { reason: null },
  { actorUserId: ADMIN_USER_B },
  { partnerId: ADMIN_PARTNER_ID },
  { decision: "APPROVED" },
])("rejects expanded or invalid command before HTTP: %#", async (override) => {
  const post = jest.spyOn(referralRejectionClient, "post");
  await expect(
    requestReferralRejection({
      ...request,
      command: { ...command, ...override } as typeof command,
    }),
  ).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
});

it.each([
  { referralId: "1-1-1-1-1" },
  { referralId: ADMIN_USER_A.toUpperCase() },
  { idempotencyKey: "short" },
  { idempotencyKey: " leading-key" },
  { idempotencyKey: "a".repeat(201) },
])("rejects unsafe target or key before HTTP: %#", async (override) => {
  const post = jest.spyOn(referralRejectionClient, "post");
  await expect(requestReferralRejection({ ...request, ...override })).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
});

it.each([
  { id: ADMIN_USER_B },
  { origin: "LINK" },
  { state: "UNDER_REVIEW" },
  { decision: "APPROVED" },
  { version: undefined },
  { version: "5" },
  { version: 6 },
  { version: Number.MAX_SAFE_INTEGER + 1 },
  { decidedAt: "tomorrow" },
  { reason: "Private reason" },
  { companyId: ADMIN_USER_B },
  { commission: 10 },
])("does not acknowledge malformed or widened evidence: %#", async (override) => {
  jest
    .spyOn(referralRejectionClient, "post")
    .mockResolvedValue({ data: { ...confirmed, ...override } });
  await expect(requestReferralRejection(request)).rejects.toThrow();
});

it("supports receipt replay reaching MAX but queue requires a persisted explicit safe version", async () => {
  jest
    .spyOn(referralRejectionClient, "post")
    .mockResolvedValue({ data: { ...confirmed, version: Number.MAX_SAFE_INTEGER } });
  expect(
    (
      await requestReferralRejection({
        ...request,
        command: { ...command, expectedVersion: Number.MAX_SAFE_INTEGER - 1 },
      })
    ).version,
  ).toBe(Number.MAX_SAFE_INTEGER);
  const item = {
    id: ADMIN_USER_A,
    partnerId: ADMIN_PARTNER_ID,
    partnerDisplayName: "Actual partner",
    partnerStatus: "ACTIVE",
    origin: "MANUAL",
    state: "UNDER_REVIEW",
    version: 0,
    businessName: "Actual lead",
    capturedAt: "2026-10-11T10:00:00Z",
    expiresAt: null,
  };
  const page = { items: [item], nextCursor: null, hasMore: false, limit: 20 };
  expect(adminReviewQueuePageResponseSchema.parse(page).items[0].version).toBe(0);
  for (const version of [undefined, "0", -1, 0.1, Number.MAX_SAFE_INTEGER + 1])
    expect(
      adminReviewQueuePageResponseSchema.safeParse({ ...page, items: [{ ...item, version }] })
        .success,
    ).toBe(false);
});

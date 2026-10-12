import {
  adminInvitationsClient,
  requestCreateInvitation,
  requestPendingInvitations,
  requestResendInvitation,
} from "../admin-invitations.api";
import { UNOPENED_INVITATIONS_MOCK } from "../../mocks/unopened-invitations.mock";
jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.review.invalid/v1/partners" },
}));
const id = "33333333-3333-4333-8333-333333333333";
const command = {
  email: "invite@example.test",
  displayName: "Test only",
  country: "PE" as const,
  profile: "AGENCY" as const,
};
const request = { accessToken: "captured-A", idempotencyKey: "stable-key-123" };
afterEach(() => jest.restoreAllMocks());
it("sends a create with captured bearer and key and returns a queued receipt, not a Partner", async () => {
  const receipt = { invitationId: id, state: "QUEUED", createdAt: "2026-10-12T00:00:00Z" };
  const post = jest.spyOn(adminInvitationsClient, "post").mockResolvedValue({ data: receipt });
  const signal = new AbortController().signal;
  expect(await requestCreateInvitation({ ...request, command, signal })).toEqual(receipt);
  expect(post).toHaveBeenCalledWith(
    "https://partners.review.invalid/v1/partners/admin/invitations",
    command,
    {
      signal,
      headers: { Authorization: "Bearer captured-A", "Idempotency-Key": request.idempotencyKey },
    },
  );
});
it.each([
  { email: "bad" },
  { displayName: " " },
  { displayName: "a\nb" },
  { displayName: "a\u0085b" },
  { displayName: "x".repeat(161) },
  { country: "CL" },
  { profile: "ADMIN" },
  { note: " " },
  { note: "x".repeat(2001) },
  { ownerUserId: id },
  { suggestedOptionCode: "A" },
])("rejects invalid commands before dispatch: %#", async (override) => {
  const post = jest.spyOn(adminInvitationsClient, "post");
  await expect(
    requestCreateInvitation({ ...request, command: { ...command, ...override } as typeof command }),
  ).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
});
it.each([
  { state: "ACTIVE" },
  { token: "secret" },
  { email: "raw@example.test" },
  { invitationId: "invalid" },
  { createdAt: "tomorrow" },
])("rejects expanded or fictitious confirmations: %#", async (override) => {
  jest.spyOn(adminInvitationsClient, "post").mockResolvedValue({
    data: { invitationId: id, state: "QUEUED", createdAt: "2026-10-12T00:00:00Z", ...override },
  });
  await expect(requestCreateInvitation({ ...request, command })).rejects.toThrow();
});
it("resends with an actual reason and validates the target receipt", async () => {
  const receipt = { invitationId: id, state: "QUEUED", queuedAt: "2026-10-12T00:00:00Z" };
  const post = jest.spyOn(adminInvitationsClient, "post").mockResolvedValue({ data: receipt });
  expect(
    await requestResendInvitation({
      ...request,
      invitationId: id,
      command: { reason: " Requested again " },
    }),
  ).toEqual(receipt);
  expect(post).toHaveBeenCalledWith(
    expect.stringContaining(`/${id}/resend`),
    { reason: "Requested again" },
    expect.objectContaining({
      headers: { Authorization: "Bearer captured-A", "Idempotency-Key": "stable-key-123" },
    }),
  );
  post.mockResolvedValueOnce({
    data: { ...receipt, invitationId: "44444444-4444-4444-8444-444444444444" },
  });
  await expect(
    requestResendInvitation({
      ...request,
      invitationId: id,
      command: { reason: "Requested again" },
    }),
  ).rejects.toThrow();
});
it("lists actual pending-acceptance items with bounded cursor, no fake opening evidence", async () => {
  const data = { items: UNOPENED_INVITATIONS_MOCK, nextCursor: null };
  const get = jest.spyOn(adminInvitationsClient, "get").mockResolvedValue({ data });
  expect(
    await requestPendingInvitations({
      accessToken: "captured-A",
      cursor: "next_cursor",
      limit: 20,
      state: "UNOPENED",
    }),
  ).toEqual(data);
  expect(get).toHaveBeenCalledWith(
    expect.stringContaining("/admin/invitations"),
    expect.objectContaining({
      params: { state: "UNOPENED", cursor: "next_cursor", limit: 20 },
      headers: { Authorization: "Bearer captured-A" },
    }),
  );
});
it.each(["ALL", "FAILED", "EXPIRED"] as const)(
  "permits actual recovery filter %s",
  async (state) => {
    const get = jest
      .spyOn(adminInvitationsClient, "get")
      .mockResolvedValue({ data: { items: [], nextCursor: null } });
    await requestPendingInvitations({ accessToken: "A", state, limit: 20 });
    expect(get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: { state, limit: 20 } }),
    );
  },
);
it.each([{ limit: 0 }, { limit: 101 }, { cursor: "../../unsafe" }])(
  "rejects unsafe pagination before dispatch: %#",
  async (override) => {
    const get = jest.spyOn(adminInvitationsClient, "get");
    await expect(requestPendingInvitations({ accessToken: "A", ...override })).rejects.toThrow();
    expect(get).not.toHaveBeenCalled();
  },
);
it.each([
  { email: "raw@example.test" },
  { token: "raw-token" },
  { state: "SENT" },
  { sentDaysAgo: 2 },
  { transportAvailability: "DELIVERED" },
])("does not accept PII or delivery claims in list: %#", async (override) => {
  jest.spyOn(adminInvitationsClient, "get").mockResolvedValue({
    data: { items: [{ ...UNOPENED_INVITATIONS_MOCK[0], ...override }], nextCursor: null },
  });
  await expect(requestPendingInvitations({ accessToken: "A" })).rejects.toThrow();
});

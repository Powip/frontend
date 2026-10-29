import { requestCreateInvitation } from "../../api/admin-invitations.api";
import { inviteAdminPartner } from "../invite-admin-partner";
jest.mock("../../api/admin-invitations.api", () => ({ requestCreateInvitation: jest.fn() }));
const form = { name: "Fixture partner", email: "fixture@example.test", profile: "dev" as const };
const request = { accessToken: "captured", idempotencyKey: "stable-key-123" };
beforeEach(() => jest.mocked(requestCreateInvitation).mockReset());
it("maps the form without inventing identity, partner or commission settings", async () => {
  const receipt = {
    invitationId: "33333333-3333-4333-8333-333333333333",
    state: "QUEUED",
    createdAt: "2026-10-12T00:00:00Z",
  };
  jest
    .mocked(requestCreateInvitation)
    .mockResolvedValue(receipt as Awaited<ReturnType<typeof requestCreateInvitation>>);
  expect(await inviteAdminPartner(form, request)).toBe(receipt);
  expect(requestCreateInvitation).toHaveBeenCalledWith({
    ...request,
    command: { displayName: form.name, email: form.email, profile: "DEVELOPER", country: "PE" },
  });
});
it.each([
  { name: " " },
  { email: "bad" },
  { name: "a\nb" },
  { name: "x".repeat(161) },
  { suggestedOptionCode: "A" },
  { userId: "client-owned" },
])("rejects invalid/expanded form before HTTP: %#", async (override) => {
  await expect(inviteAdminPartner({ ...form, ...override }, request)).rejects.toThrow();
  expect(requestCreateInvitation).not.toHaveBeenCalled();
});
it("propagates a real failure without a partner fixture or fabricated success", async () => {
  jest.mocked(requestCreateInvitation).mockRejectedValue(new Error("Transport outcome unknown"));
  await expect(inviteAdminPartner(form, request)).rejects.toThrow("Transport outcome unknown");
});

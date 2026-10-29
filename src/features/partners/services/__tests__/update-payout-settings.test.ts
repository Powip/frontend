import { payoutSettingsClient } from "../../api/payout-settings.api";
import { updatePayoutSettings } from "../update-payout-settings";
jest.mock("@/lib/api", () => ({ API: { partners: "https://partners.review.invalid/v1/partners" } }));
const command = { method: "yape" as const, accountNumber: "fixture-account", accountHolder: "Fixture holder", expectedVersion: null, reason: "Fixture update" };
const settings = { method: "yape", accountNumber: "fixture-account", accountHolder: "Fixture holder", version: 0, updatedAt: "2026-10-11T00:00:00Z" };
afterEach(() => jest.restoreAllMocks());
it("pins the actor Bearer, explicit initial version and stable retry key with no ownership field", async () => {
  const post = jest.spyOn(payoutSettingsClient, "post").mockResolvedValue({ data: { settings } });
  const signal = new AbortController().signal;
  expect(await updatePayoutSettings({ accessToken: "session-A", signal, command, idempotencyKey: "stable-key-001" })).toEqual(settings);
  expect(post).toHaveBeenCalledWith("https://partners.review.invalid/v1/partners/me/payout-settings", command, { headers: { Authorization: "Bearer session-A", "Idempotency-Key": "stable-key-001" }, signal });
});
it.each(["", " key-with-space "])("rejects invalid retry key before dispatch: %s", async (idempotencyKey) => {
  const post = jest.spyOn(payoutSettingsClient, "post");
  await expect(updatePayoutSettings({ accessToken: "session-A", command, idempotencyKey })).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
});
it("does not convert a null saved response into a fictitious account", async () => {
  jest.spyOn(payoutSettingsClient, "post").mockResolvedValue({ data: { settings: null } });
  await expect(updatePayoutSettings({ accessToken: "session-A", command, idempotencyKey: "stable-key-001" })).rejects.toThrow();
});
it("rejects browser-selected owner before HTTP", async () => {
  const post = jest.spyOn(payoutSettingsClient, "post");
  await expect(updatePayoutSettings({ accessToken: "session-A", command: { ...command, ownerUserId: "spoofed" } as typeof command, idempotencyKey: "stable-key-001" })).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
});

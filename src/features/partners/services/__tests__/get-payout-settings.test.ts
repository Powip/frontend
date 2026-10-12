import { payoutSettingsClient } from "../../api/payout-settings.api";
import { getPayoutSettings } from "../get-payout-settings";
jest.mock("@/lib/api", () => ({ API: { partners: "https://partners.review.invalid/v1/partners" } }));
afterEach(() => jest.restoreAllMocks());

it("reads actual own settings and preserves an absent account as null", async () => {
  const get = jest.spyOn(payoutSettingsClient, "get").mockResolvedValue({ data: { settings: null } });
  const signal = new AbortController().signal;
  expect(await getPayoutSettings("session-A", signal)).toBeNull();
  expect(get).toHaveBeenCalledWith("https://partners.review.invalid/v1/partners/me/payout-settings", { headers: { Authorization: "Bearer session-A" }, signal });
});
it("requires Bearer and never fabricates settings on error", async () => {
  const get = jest.spyOn(payoutSettingsClient, "get");
  await expect(getPayoutSettings("")).rejects.toThrow(); expect(get).not.toHaveBeenCalled();
  get.mockRejectedValue(new Error("upstream unavailable"));
  await expect(getPayoutSettings("session-A")).rejects.toThrow("upstream unavailable");
});
it.each([
  { settings: { method: "yape", accountNumber: "fixture", accountHolder: "fixture", minimumThreshold: 50 } },
  { settings: null, ownerUserId: "spoofed" },
  { settings: { method: "yape", accountNumber: "fixture", accountHolder: "fixture", version: 9_007_199_254_740_992, updatedAt: "2026-10-11T00:00:00Z" } },
])("rejects expanded/legacy or unsafe-version contracts: %#", async (data) => {
  jest.spyOn(payoutSettingsClient, "get").mockResolvedValue({ data });
  await expect(getPayoutSettings("session-A")).rejects.toThrow();
});

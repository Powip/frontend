import { updatePayoutSettings } from "../update-payout-settings";
import { PartnersFeatureUnavailableError } from "../../utils/unavailable-partners-feature";

describe("updatePayoutSettings", () => {
  it("rechaza la operación pendiente sin devolver datos ni éxitos simulados", async () => {
    await expect(
      updatePayoutSettings({ method: "yape", accountNumber: "fixture-account" }),
    ).rejects.toMatchObject({
      code: "PERMANENT_FEATURE_UNAVAILABLE",
      name: "PartnersFeatureUnavailableError",
    });
  });

  it("informa explícitamente que la operación todavía no está implementada", async () => {
    await expect(
      updatePayoutSettings({ method: "yape", accountNumber: "fixture-account" }),
    ).rejects.toBeInstanceOf(PartnersFeatureUnavailableError);
    await expect(
      updatePayoutSettings({ method: "yape", accountNumber: "fixture-account" }),
    ).rejects.toThrow(/todavía no está implementado/);
  });
});

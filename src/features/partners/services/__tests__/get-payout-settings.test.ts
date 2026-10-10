import { getPayoutSettings } from "../get-payout-settings";
import { PartnersFeatureUnavailableError } from "../../utils/unavailable-partners-feature";

describe("getPayoutSettings", () => {
  it("rechaza la operación pendiente sin devolver datos ni éxitos simulados", async () => {
    await expect(getPayoutSettings()).rejects.toMatchObject({
      code: "PERMANENT_FEATURE_UNAVAILABLE",
      name: "PartnersFeatureUnavailableError",
    });
  });

  it("informa explícitamente que la operación todavía no está implementada", async () => {
    await expect(getPayoutSettings()).rejects.toBeInstanceOf(PartnersFeatureUnavailableError);
    await expect(getPayoutSettings()).rejects.toThrow(/todavía no está implementado/);
  });
});

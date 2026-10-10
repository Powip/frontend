import { getPayoutHistory } from "../get-payout-history";
import { PartnersFeatureUnavailableError } from "../../utils/unavailable-partners-feature";

describe("getPayoutHistory", () => {
  it("rechaza la operación pendiente sin devolver datos ni éxitos simulados", async () => {
    await expect(getPayoutHistory()).rejects.toMatchObject({
      code: "PERMANENT_FEATURE_UNAVAILABLE",
      name: "PartnersFeatureUnavailableError",
    });
  });

  it("informa explícitamente que la operación todavía no está implementada", async () => {
    await expect(getPayoutHistory()).rejects.toBeInstanceOf(PartnersFeatureUnavailableError);
    await expect(getPayoutHistory()).rejects.toThrow(/todavía no está implementado/);
  });
});

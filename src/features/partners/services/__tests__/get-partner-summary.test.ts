import { getPartnerSummary } from "../get-partner-summary";
import { PartnersFeatureUnavailableError } from "../../utils/unavailable-partners-feature";

describe("getPartnerSummary", () => {
  it("rechaza la operación pendiente sin devolver datos ni éxitos simulados", async () => {
    await expect(getPartnerSummary()).rejects.toMatchObject({
      code: "PERMANENT_FEATURE_UNAVAILABLE",
      name: "PartnersFeatureUnavailableError",
    });
  });

  it("informa explícitamente que la operación todavía no está implementada", async () => {
    await expect(getPartnerSummary()).rejects.toBeInstanceOf(PartnersFeatureUnavailableError);
    await expect(getPartnerSummary()).rejects.toThrow(/todavía no está implementado/);
  });
});

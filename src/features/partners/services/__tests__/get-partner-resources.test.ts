import { getPartnerResources } from "../get-partner-resources";
import { PartnersFeatureUnavailableError } from "../../utils/unavailable-partners-feature";

describe("getPartnerResources", () => {
  it("rechaza la operación pendiente sin devolver datos ni éxitos simulados", async () => {
    await expect(getPartnerResources()).rejects.toMatchObject({
      code: "PERMANENT_FEATURE_UNAVAILABLE",
      name: "PartnersFeatureUnavailableError",
    });
  });

  it("informa explícitamente que la operación todavía no está implementada", async () => {
    await expect(getPartnerResources()).rejects.toBeInstanceOf(PartnersFeatureUnavailableError);
    await expect(getPartnerResources()).rejects.toThrow(/todavía no está implementado/);
  });
});

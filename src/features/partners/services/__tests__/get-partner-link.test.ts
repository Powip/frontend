import { getPartnerLink } from "../get-partner-link";
import { PartnersFeatureUnavailableError } from "../../utils/unavailable-partners-feature";

describe("getPartnerLink", () => {
  it("rechaza la operación pendiente sin devolver datos ni éxitos simulados", async () => {
    await expect(getPartnerLink()).rejects.toMatchObject({
      code: "PERMANENT_FEATURE_UNAVAILABLE",
      name: "PartnersFeatureUnavailableError",
    });
  });

  it("informa explícitamente que la operación todavía no está implementada", async () => {
    await expect(getPartnerLink()).rejects.toBeInstanceOf(PartnersFeatureUnavailableError);
    await expect(getPartnerLink()).rejects.toThrow(/todavía no está implementado/);
  });
});

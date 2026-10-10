import { getCommissionOptions } from "../get-commission-options";
import { PartnersFeatureUnavailableError } from "../../utils/unavailable-partners-feature";

describe("getCommissionOptions", () => {
  it("rechaza la operación pendiente sin devolver datos ni éxitos simulados", async () => {
    await expect(getCommissionOptions()).rejects.toMatchObject({
      code: "PERMANENT_FEATURE_UNAVAILABLE",
      name: "PartnersFeatureUnavailableError",
    });
  });

  it("informa explícitamente que la operación todavía no está implementada", async () => {
    await expect(getCommissionOptions()).rejects.toBeInstanceOf(PartnersFeatureUnavailableError);
    await expect(getCommissionOptions()).rejects.toThrow(/todavía no está implementado/);
  });
});

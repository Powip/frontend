import { getCommissionLines } from "../get-commission-lines";
import { PartnersFeatureUnavailableError } from "../../utils/unavailable-partners-feature";

describe("getCommissionLines", () => {
  it("rechaza la operación pendiente sin devolver datos ni éxitos simulados", async () => {
    await expect(getCommissionLines()).rejects.toMatchObject({
      code: "PERMANENT_FEATURE_UNAVAILABLE",
      name: "PartnersFeatureUnavailableError",
    });
  });

  it("informa explícitamente que la operación todavía no está implementada", async () => {
    await expect(getCommissionLines()).rejects.toBeInstanceOf(PartnersFeatureUnavailableError);
    await expect(getCommissionLines()).rejects.toThrow(/todavía no está implementado/);
  });
});

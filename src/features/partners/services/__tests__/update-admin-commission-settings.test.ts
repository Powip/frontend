import { updateAdminCommissionSettings } from "../update-admin-commission-settings";
import { PartnersFeatureUnavailableError } from "../../utils/unavailable-partners-feature";

describe("updateAdminCommissionSettings", () => {
  it("rechaza la operación pendiente sin devolver datos ni éxitos simulados", async () => {
    await expect(updateAdminCommissionSettings({})).rejects.toMatchObject({
      code: "PERMANENT_FEATURE_UNAVAILABLE",
      name: "PartnersFeatureUnavailableError",
    });
  });

  it("informa explícitamente que la operación todavía no está implementada", async () => {
    await expect(updateAdminCommissionSettings({})).rejects.toBeInstanceOf(
      PartnersFeatureUnavailableError,
    );
    await expect(updateAdminCommissionSettings({})).rejects.toThrow(/todavía no está implementado/);
  });
});

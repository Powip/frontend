import { payAdminLiquidation } from "../pay-admin-liquidation";
import { PartnersFeatureUnavailableError } from "../../utils/unavailable-partners-feature";

describe("payAdminLiquidation", () => {
  it("rechaza la operación pendiente sin devolver datos ni éxitos simulados", async () => {
    await expect(payAdminLiquidation("fixture-id")).rejects.toMatchObject({
      code: "PERMANENT_FEATURE_UNAVAILABLE",
      name: "PartnersFeatureUnavailableError",
    });
  });

  it("informa explícitamente que la operación todavía no está implementada", async () => {
    await expect(payAdminLiquidation("fixture-id")).rejects.toBeInstanceOf(
      PartnersFeatureUnavailableError,
    );
    await expect(payAdminLiquidation("fixture-id")).rejects.toThrow(/todavía no está implementado/);
  });
});

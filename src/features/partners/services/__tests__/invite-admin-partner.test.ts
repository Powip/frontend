import { inviteAdminPartner } from "../invite-admin-partner";
import { PartnersFeatureUnavailableError } from "../../utils/unavailable-partners-feature";

describe("inviteAdminPartner", () => {
  it("rechaza la operación pendiente sin devolver datos ni éxitos simulados", async () => {
    await expect(
      inviteAdminPartner({
        name: "Fixture partner",
        email: "fixture@example.test",
        profile: "dev",
        suggestedOptionCode: "A",
      }),
    ).rejects.toMatchObject({
      code: "PERMANENT_FEATURE_UNAVAILABLE",
      name: "PartnersFeatureUnavailableError",
    });
  });

  it("informa explícitamente que la operación todavía no está implementada", async () => {
    await expect(
      inviteAdminPartner({
        name: "Fixture partner",
        email: "fixture@example.test",
        profile: "dev",
        suggestedOptionCode: "A",
      }),
    ).rejects.toBeInstanceOf(PartnersFeatureUnavailableError);
    await expect(
      inviteAdminPartner({
        name: "Fixture partner",
        email: "fixture@example.test",
        profile: "dev",
        suggestedOptionCode: "A",
      }),
    ).rejects.toThrow(/todavía no está implementado/);
  });
});

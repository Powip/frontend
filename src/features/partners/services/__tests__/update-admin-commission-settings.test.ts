/**
 * Tests: updateAdminCommissionSettings
 *
 * Comportamiento verificado:
 * 1. Actualiza solo las claves incluidas en el update (merge parcial).
 * 2. No pisa las claves que no se incluyeron en el update.
 * 3. Los cambios persisten entre llamadas sucesivas de getAdminCommissionSettings.
 */

import { updateAdminCommissionSettings } from "../update-admin-commission-settings";
import { getAdminCommissionSettings } from "../get-admin-commission-settings";
import { resetAdminCommissionSettingsStore } from "../../mocks/admin-commission-settings.store";

describe("updateAdminCommissionSettings", () => {
  beforeEach(() => {
    resetAdminCommissionSettingsStore();
  });

  it("actualiza solo las claves incluidas en el update", async () => {
    const result = await updateAdminCommissionSettings({
      discount: { pct: 15, duration: "primer_mes", assumedBy: "powip" },
    });

    expect(result.discount.pct).toBe(15);
  });

  it("no pisa las claves que no se incluyeron", async () => {
    const before = await getAdminCommissionSettings();
    await updateAdminCommissionSettings({
      discount: { pct: 15, duration: "primer_mes", assumedBy: "powip" },
    });
    const after = await getAdminCommissionSettings();

    expect(after.commissionRules).toEqual(before.commissionRules);
    expect(after.programRules).toEqual(before.programRules);
  });

  it("los cambios persisten entre llamadas sucesivas", async () => {
    await updateAdminCommissionSettings({
      programRules: {
        autoApproveLinkWithoutConflict: false,
        blockSelfReferral: true,
        attributionWindowDays: 90,
        invitationExpirationDays: 30,
        minimumPayoutThreshold: 100,
      },
    });

    const result = await getAdminCommissionSettings();
    expect(result.programRules.attributionWindowDays).toBe(90);
    expect(result.programRules.minimumPayoutThreshold).toBe(100);
  });
});

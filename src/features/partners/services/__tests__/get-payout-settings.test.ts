/**
 * Tests: getPayoutSettings
 *
 * Comportamiento verificado:
 * 1. Resuelve con los datos de cobro actuales del store.
 * 2. Refleja una actualización previa hecha con updatePayoutSettings (mismo store).
 */

import { getPayoutSettings } from "../get-payout-settings";
import { updatePayoutSettings } from "../update-payout-settings";
import { resetPayoutSettingsStore } from "../../mocks/payout-settings.store";

describe("getPayoutSettings", () => {
  beforeEach(() => {
    resetPayoutSettingsStore();
  });

  it("resuelve con los datos de cobro actuales", async () => {
    const result = await getPayoutSettings();
    expect(result.method).toBe("yape");
    expect(result.accountNumber).toBe("987 654 321");
  });

  it("refleja una actualización previa", async () => {
    await updatePayoutSettings({ method: "plin", accountNumber: "999 111 222" });
    const result = await getPayoutSettings();
    expect(result.method).toBe("plin");
    expect(result.accountNumber).toBe("999 111 222");
  });
});

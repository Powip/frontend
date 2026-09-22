/**
 * Tests: updatePayoutSettings
 *
 * Comportamiento verificado:
 * 1. Actualiza método y número/cuenta, y los devuelve en el resultado.
 * 2. No modifica accountHolder ni minimumThreshold (no son editables por este form).
 */

import { updatePayoutSettings } from "../update-payout-settings";
import { resetPayoutSettingsStore } from "../../mocks/payout-settings.store";

describe("updatePayoutSettings", () => {
  beforeEach(() => {
    resetPayoutSettingsStore();
  });

  it("actualiza método y número/cuenta", async () => {
    const result = await updatePayoutSettings({ method: "transferencia", accountNumber: "BCP 123-456" });
    expect(result.method).toBe("transferencia");
    expect(result.accountNumber).toBe("BCP 123-456");
  });

  it("no modifica accountHolder ni minimumThreshold", async () => {
    const before = await updatePayoutSettings({ method: "yape", accountNumber: "111 222 333" });
    const after = await updatePayoutSettings({ method: "plin", accountNumber: "444 555 666" });
    expect(after.accountHolder).toBe(before.accountHolder);
    expect(after.minimumThreshold).toBe(before.minimumThreshold);
  });
});

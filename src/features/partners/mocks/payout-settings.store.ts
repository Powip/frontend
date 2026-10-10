import type { PayoutSettings } from "../models/payout-settings";

const SEED: PayoutSettings = {
  method: "yape",
  accountNumber: "987 654 321",
  accountHolder: "Joel Coila",
  minimumThreshold: 50,
};

let settings: PayoutSettings = { ...SEED };

export function getPayoutSettingsFromStore(): PayoutSettings {
  return settings;
}

export function updatePayoutSettingsInStore(
  update: Pick<PayoutSettings, "method" | "accountNumber">,
): PayoutSettings {
  settings = { ...settings, ...update };
  return settings;
}

export function resetPayoutSettingsStore(): void {
  settings = { ...SEED };
}

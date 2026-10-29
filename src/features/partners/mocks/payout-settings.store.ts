import type { PayoutSettings } from "../models/payout-settings";

const SEED: PayoutSettings = {
  method: "yape",
  accountNumber: "987 654 321",
  accountHolder: "Joel Coila",
  version: 0,
  updatedAt: "2026-10-01T00:00:00Z",
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

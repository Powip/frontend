import { getPayoutSettingsFromStore } from "../mocks/payout-settings.store";
import type { PayoutSettings } from "../models/payout-settings";

export async function getPayoutSettings(): Promise<PayoutSettings> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return getPayoutSettingsFromStore();
}

import { updatePayoutSettingsInStore } from "../mocks/payout-settings.store";
import type { PayoutSettings } from "../models/payout-settings";
import type { UpdatePayoutSettingsFormValues } from "../schemas/update-payout-settings.schema";

export async function updatePayoutSettings(
  input: UpdatePayoutSettingsFormValues,
): Promise<PayoutSettings> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return updatePayoutSettingsInStore(input);
}

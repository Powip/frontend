import type { PayoutSettings } from "../models/payout-settings";
import type { UpdatePayoutSettingsFormValues } from "../schemas/update-payout-settings.schema";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function updatePayoutSettings(
  input: UpdatePayoutSettingsFormValues,
): Promise<PayoutSettings> {
  void input;
  return unavailablePartnersFeature("Actualizar datos de cobro");
}

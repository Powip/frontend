import { updateAdminCommissionSettingsInStore } from "../mocks/admin-commission-settings.store";
import type { AdminCommissionSettings } from "../models/admin-commission-settings";

export async function updateAdminCommissionSettings(
  update: Partial<AdminCommissionSettings>,
): Promise<AdminCommissionSettings> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return updateAdminCommissionSettingsInStore(update);
}

import { getAdminCommissionSettingsFromStore } from "../mocks/admin-commission-settings.store";
import type { AdminCommissionSettings } from "../models/admin-commission-settings";

export async function getAdminCommissionSettings(): Promise<AdminCommissionSettings> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return getAdminCommissionSettingsFromStore();
}

import { ADMIN_COMMISSION_SETTINGS_MOCK } from "./admin-commission-settings.mock";
import type { AdminCommissionSettings } from "../models/admin-commission-settings";

function cloneSettings(source: AdminCommissionSettings): AdminCommissionSettings {
  return JSON.parse(JSON.stringify(source));
}

let settings: AdminCommissionSettings = cloneSettings(ADMIN_COMMISSION_SETTINGS_MOCK);

export function getAdminCommissionSettingsFromStore(): AdminCommissionSettings {
  return settings;
}

export function updateAdminCommissionSettingsInStore(
  update: Partial<AdminCommissionSettings>,
): AdminCommissionSettings {
  settings = { ...settings, ...update };
  return settings;
}

export function resetAdminCommissionSettingsStore(): void {
  settings = cloneSettings(ADMIN_COMMISSION_SETTINGS_MOCK);
}

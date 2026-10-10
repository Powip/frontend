import type { AdminCommissionSettings } from "../models/admin-commission-settings";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function updateAdminCommissionSettings(
  update: Partial<AdminCommissionSettings>,
): Promise<AdminCommissionSettings> {
  void update;
  return unavailablePartnersFeature("Actualizar reglas y comisiones");
}

import type { AdminCommissionSettings } from "../models/admin-commission-settings";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getAdminCommissionSettings(): Promise<AdminCommissionSettings> {
  return unavailablePartnersFeature("Consultar reglas y comisiones");
}

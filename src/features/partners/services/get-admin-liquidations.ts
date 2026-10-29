import type { AdminLiquidationRow } from "../models/admin-liquidation-row";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getAdminLiquidations(): Promise<AdminLiquidationRow[]> {
  return unavailablePartnersFeature("Consultar liquidaciones");
}

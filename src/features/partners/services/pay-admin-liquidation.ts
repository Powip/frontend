import type { AdminLiquidationRow } from "../models/admin-liquidation-row";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function payAdminLiquidation(id: string): Promise<AdminLiquidationRow> {
  void id;
  return unavailablePartnersFeature("Marcar una liquidación como pagada");
}

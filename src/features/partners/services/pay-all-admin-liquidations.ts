import type { AdminLiquidationRow } from "../models/admin-liquidation-row";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function payAllAdminLiquidations(): Promise<AdminLiquidationRow[]> {
  return unavailablePartnersFeature("Liquidar un ciclo completo");
}

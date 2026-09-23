import { listAdminLiquidations } from "../mocks/admin-liquidations.store";
import type { AdminLiquidationRow } from "../models/admin-liquidation-row";

export async function getAdminLiquidations(): Promise<AdminLiquidationRow[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return listAdminLiquidations();
}

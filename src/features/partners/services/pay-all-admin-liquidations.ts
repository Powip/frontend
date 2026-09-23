import { markAllAdminLiquidationsPaid } from "../mocks/admin-liquidations.store";
import type { AdminLiquidationRow } from "../models/admin-liquidation-row";

export async function payAllAdminLiquidations(): Promise<AdminLiquidationRow[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return markAllAdminLiquidationsPaid();
}

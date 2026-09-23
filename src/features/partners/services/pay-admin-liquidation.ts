import { markAdminLiquidationPaid } from "../mocks/admin-liquidations.store";
import type { AdminLiquidationRow } from "../models/admin-liquidation-row";

export async function payAdminLiquidation(id: string): Promise<AdminLiquidationRow> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const updated = markAdminLiquidationPaid(id);
  if (!updated) {
    throw new Error("Liquidación no encontrada");
  }

  return updated;
}

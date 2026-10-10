import { ADMIN_LIQUIDATIONS_MOCK } from "./admin-liquidations.mock";
import type { AdminLiquidationRow } from "../models/admin-liquidation-row";

let liquidations: AdminLiquidationRow[] = [...ADMIN_LIQUIDATIONS_MOCK];

export function listAdminLiquidations(): AdminLiquidationRow[] {
  return liquidations;
}

export function markAdminLiquidationPaid(id: string): AdminLiquidationRow | undefined {
  let updated: AdminLiquidationRow | undefined;
  liquidations = liquidations.map((row) => {
    if (row.id !== id) return row;
    updated = { ...row, paid: true };
    return updated;
  });
  return updated;
}

export function markAllAdminLiquidationsPaid(): AdminLiquidationRow[] {
  liquidations = liquidations.map((row) => ({ ...row, paid: true }));
  return liquidations;
}

export function resetAdminLiquidationsStore(): void {
  liquidations = [...ADMIN_LIQUIDATIONS_MOCK];
}

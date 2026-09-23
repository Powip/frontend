import { ADMIN_CLAWBACKS_MOCK } from "../mocks/admin-liquidations.mock";
import type { AdminClawback } from "../models/admin-liquidation-row";

export async function getAdminClawbacks(): Promise<AdminClawback[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return ADMIN_CLAWBACKS_MOCK;
}

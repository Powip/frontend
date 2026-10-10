import type { AdminClawback } from "../models/admin-liquidation-row";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getAdminClawbacks(): Promise<AdminClawback[]> {
  return unavailablePartnersFeature("Consultar reversos y clawbacks");
}

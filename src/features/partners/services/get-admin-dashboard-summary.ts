import type { AdminDashboardSummary } from "../models/admin-dashboard-summary";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  return unavailablePartnersFeature("Consultar métricas administrativas");
}

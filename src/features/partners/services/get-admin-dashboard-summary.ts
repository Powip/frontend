import { ADMIN_DASHBOARD_SUMMARY_MOCK } from "../mocks/admin-dashboard.mock";
import type { AdminDashboardSummary } from "../models/admin-dashboard-summary";

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return ADMIN_DASHBOARD_SUMMARY_MOCK;
}

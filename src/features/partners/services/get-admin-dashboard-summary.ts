import { type AdminReadRequest, requestAdminDashboardSummary } from "../api/admin-partners.api";

export function getAdminDashboardSummary(request: AdminReadRequest) {
  return requestAdminDashboardSummary(request);
}

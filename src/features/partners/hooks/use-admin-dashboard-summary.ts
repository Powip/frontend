import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { AdminDashboardSummary } from "../models/admin-dashboard-summary";
import { getAdminDashboardSummary } from "../services/get-admin-dashboard-summary";

export function useAdminDashboardSummary() {
  return useQuery<AdminDashboardSummary, Error>({
    queryKey: partnersKeys.adminDashboardSummary(),
    queryFn: getAdminDashboardSummary,
  });
}

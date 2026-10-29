import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import { getAdminDashboardSummary } from "../services/get-admin-dashboard-summary";
import { useAdminReadSession } from "./use-admin-read-session";

export function useAdminDashboardSummary() {
  const session = useAdminReadSession();
  return useQuery({
    queryKey: partnersKeys.adminDashboardSummary(session.userId, session.epoch),
    queryFn: ({ signal }) =>
      session.read(signal, (accessToken) => getAdminDashboardSummary({ accessToken, signal })),
    enabled: session.enabled,
    retry: false,
  });
}

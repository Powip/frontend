import { useQuery } from "@tanstack/react-query";
import { getClientsByCompany } from "@/services/dashboardClientsService";

export function useDashboardClients(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["dashboard-clients", companyId],
    queryFn: () => getClientsByCompany(companyId!),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

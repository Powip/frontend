import { useQuery } from "@tanstack/react-query";
import { fetchCouriers } from "@/services/courierService";

export function useDashboardCouriersList(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["dashboard-couriers-list", companyId],
    queryFn: () => fetchCouriers(companyId!),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

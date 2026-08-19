import { useQuery } from "@tanstack/react-query";
import { getSellersSummary } from "@/services/dashboardSellersService";

export function useDashboardSellers(
  companyId: string | null | undefined,
  fromDate: string | undefined,
  toDate: string | undefined,
) {
  return useQuery({
    queryKey: ["dashboard-sellers", companyId, fromDate, toDate],
    queryFn: () => getSellersSummary(companyId!, fromDate!, toDate!),
    enabled: !!companyId && !!fromDate && !!toDate,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

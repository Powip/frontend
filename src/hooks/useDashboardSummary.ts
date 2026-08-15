import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary } from "@/services/dashboardStatsService";

export function useDashboardSummary(
  storeId: string | null | undefined,
  fromDate: string | undefined,
  toDate: string | undefined,
  sellerId?: string,
) {
  return useQuery({
    queryKey: ["dashboard-summary", storeId, fromDate, toDate, sellerId],
    queryFn: () => getDashboardSummary({ storeId: storeId!, fromDate: fromDate!, toDate: toDate!, sellerId }),
    enabled: !!storeId && !!fromDate && !!toDate,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

import { useQuery } from "@tanstack/react-query";
import { getDashboardReceivables } from "@/services/dashboardStatsService";

export function useDashboardReceivables(
  storeId: string | null | undefined,
  fromDate: string | undefined,
  toDate: string | undefined,
  sellerId?: string,
) {
  return useQuery({
    queryKey: ["dashboard-receivables", storeId, fromDate, toDate, sellerId],
    queryFn: () => getDashboardReceivables({ storeId: storeId!, fromDate: fromDate!, toDate: toDate!, sellerId }),
    enabled: !!storeId && !!fromDate && !!toDate,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

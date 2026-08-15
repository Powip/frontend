import { useQuery } from "@tanstack/react-query";
import { getDashboardByChannel } from "@/services/dashboardStatsService";

export function useDashboardByChannel(
  storeId: string | null | undefined,
  fromDate: string | undefined,
  toDate: string | undefined,
  sellerId?: string,
) {
  return useQuery({
    queryKey: ["dashboard-by-channel", storeId, fromDate, toDate, sellerId],
    queryFn: () => getDashboardByChannel({ storeId: storeId!, fromDate: fromDate!, toDate: toDate!, sellerId }),
    enabled: !!storeId && !!fromDate && !!toDate,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

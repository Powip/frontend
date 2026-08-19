import { useQuery } from "@tanstack/react-query";
import { getDashboardByLocation } from "@/services/dashboardStatsService";

export function useDashboardByLocation(
  storeId: string | null | undefined,
  fromDate: string | undefined,
  toDate: string | undefined,
  sellerId?: string,
) {
  return useQuery({
    queryKey: ["dashboard-by-location", storeId, fromDate, toDate, sellerId],
    queryFn: () => getDashboardByLocation({ storeId: storeId!, fromDate: fromDate!, toDate: toDate!, sellerId }, "city"),
    enabled: !!storeId && !!fromDate && !!toDate,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

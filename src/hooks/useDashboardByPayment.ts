import { useQuery } from "@tanstack/react-query";
import { getDashboardByPayment } from "@/services/dashboardStatsService";

export function useDashboardByPayment(
  storeId: string | null | undefined,
  fromDate: string | undefined,
  toDate: string | undefined,
  sellerId?: string,
) {
  return useQuery({
    queryKey: ["dashboard-by-payment", storeId, fromDate, toDate, sellerId],
    queryFn: () => getDashboardByPayment({ storeId: storeId!, fromDate: fromDate!, toDate: toDate!, sellerId }),
    enabled: !!storeId && !!fromDate && !!toDate,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

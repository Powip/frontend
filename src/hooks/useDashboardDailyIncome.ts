import { useQuery } from "@tanstack/react-query";
import { getDailyIncome } from "@/services/dashboardFinanceService";

export function useDashboardDailyIncome(
  storeId: string | null | undefined,
  fromDate: string | undefined,
  toDate: string | undefined,
  sellerId?: string,
) {
  return useQuery({
    queryKey: ["dashboard-daily-income", storeId, fromDate, toDate, sellerId],
    queryFn: () => getDailyIncome(storeId!, fromDate!, toDate!, sellerId),
    enabled: !!storeId && !!fromDate && !!toDate,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

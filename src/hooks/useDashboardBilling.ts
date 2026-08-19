import { useQuery } from "@tanstack/react-query";
import { getBilling } from "@/services/dashboardFinanceService";

export function useDashboardBilling(
  storeId: string | null | undefined,
  year: string | undefined,
  sellerId?: string,
) {
  return useQuery({
    queryKey: ["dashboard-billing", storeId, year, sellerId],
    queryFn: () => getBilling(storeId!, year!, sellerId),
    enabled: !!storeId && !!year,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

import { useQuery } from "@tanstack/react-query";
import { getDeliveryBySeller } from "@/services/dashboardSellersService";

export function useDashboardDeliveryBySeller(
  storeId: string | null | undefined,
  fromDate: string | undefined,
  toDate: string | undefined,
) {
  return useQuery({
    queryKey: ["dashboard-delivery-by-seller", storeId, fromDate, toDate],
    queryFn: () => getDeliveryBySeller(storeId!, fromDate!, toDate!),
    enabled: !!storeId && !!fromDate && !!toDate,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

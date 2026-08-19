import { useQuery } from "@tanstack/react-query";
import { getOrdersByStore } from "@/services/dashboardOrdersService";

export function useDashboardOrders(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ["dashboard-orders", storeId],
    queryFn: () => getOrdersByStore(storeId!),
    enabled: !!storeId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

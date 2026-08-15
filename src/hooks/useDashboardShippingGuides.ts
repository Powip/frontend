import { useQuery } from "@tanstack/react-query";
import { getShippingGuidesByStore } from "@/services/dashboardCourierService";

export function useDashboardShippingGuides(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ["dashboard-shipping-guides", storeId],
    queryFn: () => getShippingGuidesByStore(storeId!),
    enabled: !!storeId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

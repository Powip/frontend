import { useQuery } from "@tanstack/react-query";
import { getInventoryItemsByInventoryId } from "@/services/dashboardInventoryService";

export function useDashboardInventory(inventoryId: string | null | undefined) {
  return useQuery({
    queryKey: ["dashboard-inventory-items", inventoryId],
    queryFn: () => getInventoryItemsByInventoryId(inventoryId!),
    enabled: !!inventoryId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

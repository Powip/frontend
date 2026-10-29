import { useQuery } from "@tanstack/react-query";
import { getIncompleteOrders } from "@/services/incompleteOrdersService";
import { OrderHeader } from "@/interfaces/IOrder";
import { useAuth } from "@/contexts/AuthContext";

export function useIncompleteOrders(storeId: string | null | undefined) {
  const { auth } = useAuth();
  return useQuery<OrderHeader[]>({
    queryKey: [
      "orders",
      "incomplete",
      auth?.company?.id,
      auth?.user?.id,
      storeId,
    ],
    queryFn: () => getIncompleteOrders(storeId!),
    enabled: !!storeId && !!auth?.company?.id && !!auth?.user?.id,
  });
}

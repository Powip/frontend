import { useQuery } from '@tanstack/react-query';
import { getIncompleteOrders } from '@/services/incompleteOrdersService';
import { OrderHeader } from '@/interfaces/IOrder';

export function useIncompleteOrders(storeId: string | null | undefined) {
  return useQuery<OrderHeader[]>({
    queryKey: ['orders', 'incomplete', storeId],
    queryFn: () => getIncompleteOrders(storeId!),
    enabled: !!storeId,
  });
}

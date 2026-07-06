import { useQuery } from '@tanstack/react-query';
import axiosAuth from '@/lib/axiosAuth';
import { GATEWAY } from '@/lib/gateway';
import { OrderHeader } from '@/interfaces/IOrder';

export function useOrdersByStore(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ['orders', 'store', storeId],
    queryFn: async () => {
      const res = await axiosAuth.get<OrderHeader[]>(
        `${GATEWAY.ventas}/order-header/store/${storeId}`,
      );
      return res.data;
    },
    enabled: !!storeId,
  });
}

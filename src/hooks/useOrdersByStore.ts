import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { OrderHeader } from '@/interfaces/IOrder';

export function useOrdersByStore(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ['orders', 'store', storeId],
    queryFn: async () => {
      const res = await axios.get<OrderHeader[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${storeId}`,
      );
      return res.data;
    },
    enabled: !!storeId,
  });
}

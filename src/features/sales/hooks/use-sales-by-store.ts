import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { salesKeys } from "@/features/sales/keys/sales.keys";
import type { Order } from "@/features/sales/models/order";
import * as service from "@/features/sales/services/sales.service";

export function useSalesByStore(storeId: string): UseQueryResult<Order[], Error> {
  return useQuery({
    queryKey: salesKeys.byStore(storeId),
    queryFn: () => service.getSalesByStore(storeId),
    enabled: !!storeId,
  });
}

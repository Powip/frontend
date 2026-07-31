import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { salesKeys } from "@/api/sales/keys/sales.keys";
import * as service from "@/services/sales/sales.service";
import { Order } from "@/models/sales/order";

export function useSalesByStore(
  storeId: string
): UseQueryResult<Order[], Error> {
  return useQuery({
    queryKey: salesKeys.byStore(storeId),
    queryFn: () => service.getSalesByStore(storeId),
    enabled: !!storeId,
  });
}

import { toOrder } from "@/api/sales/mappers/to-order.mapper";
import * as api from "@/api/sales/sales.api";
import { Order } from "@/models/sales/order";

export async function getSalesByStore(
  storeId: string
): Promise<Order[]> {
  const responseDtos = await api.getSalesByStore(storeId);

  return responseDtos.map(toOrder);
}

import { toOrder } from "@/features/sales/mappers/to-order.mapper";
import type { Order } from "@/features/sales/models/order";
import * as api from "@/features/sales/sales.api";

export async function getSalesByStore(storeId: string): Promise<Order[]> {
  const responseDtos = await api.getSalesByStore(storeId);

  return responseDtos.map(toOrder);
}

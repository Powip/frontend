import { toOrder } from "@/features/sales/mappers/to-order.mapper";
import type { Order } from "@/features/sales/models/order";
import * as api from "@/features/sales/sales.api";

export async function getSalesByStore(storeId: string): Promise<Order[]> {
  const responseDtos = await api.getSalesByStore(storeId);

  return responseDtos.map(toOrder);
}

export async function getSalesByStores(storeIds: string[], signal?: AbortSignal): Promise<Order[]> {
  const responses = await Promise.all([...new Set(storeIds)].map((storeId) => api.getSalesByStore(storeId, signal)));
  return Array.from(new Map(responses.flat().map((dto) => [dto.id, dto])).values()).map(toOrder);
}

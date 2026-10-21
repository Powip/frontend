import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { OrderResponseDto } from "@/features/sales/dto/order.dto";
import { isCommercialSale } from "@/utils/commercialOrderReporting";

export async function getDashboardOrders<T extends { id: string } = OrderResponseDto>(
  storeIds: string[],
  fromDate: string | undefined,
  toDate: string | undefined,
  accessToken: string,
  options: { signal?: AbortSignal; includeCcLeads?: boolean; currency?: string; includeCommercialLeads?: boolean } = {},
): Promise<T[]> {
  const responses = await Promise.all(
    [...new Set(storeIds)].map((storeId) =>
      axiosAuth.get<T[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS || GATEWAY.ventas}/order-header/store/${storeId}`,
        {
          params: { fromDate, toDate, ...(options.includeCcLeads ? { includeCcLeads: true } : {}) },
          headers: { Authorization: `Bearer ${accessToken}` },
          ...(options.signal ? { signal: options.signal } : {}),
        },
      ),
    ),
  );
  if (responses.some((response) => !Array.isArray(response.data))) throw new Error("Respuesta de pedidos inválida");
  return Array.from(new Map(responses.flatMap((response) => response.data).filter((order) => options.includeCommercialLeads || isCommercialSale(order)).filter((order) => !options.currency || ((order as {currency?: string | null}).currency ?? "UNKNOWN") === options.currency).map((order) => [order.id, order])).values());
}

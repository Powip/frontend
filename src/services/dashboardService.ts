import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { OrderResponseDto } from "@/features/sales/dto/order.dto";

export async function getDashboardOrders(
  storeIds: string[],
  fromDate: string | undefined,
  toDate: string | undefined,
  accessToken: string,
  options: { signal?: AbortSignal; includeCcLeads?: boolean } = {},
): Promise<OrderResponseDto[]> {
  const responses = await Promise.all(
    [...new Set(storeIds)].map((storeId) =>
      axiosAuth.get<OrderResponseDto[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS || GATEWAY.ventas}/order-header/store/${storeId}`,
        {
          params: { fromDate, toDate, ...(options.includeCcLeads ? { includeCcLeads: true } : {}) },
          headers: { Authorization: `Bearer ${accessToken}` },
          ...(options.signal ? { signal: options.signal } : {}),
        },
      ),
    ),
  );
  return Array.from(new Map(responses.flatMap((response) => response.data).map((order) => [order.id, order])).values());
}

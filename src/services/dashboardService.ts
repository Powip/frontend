import axiosAuth from "@/lib/axiosAuth";
import type { OrderResponseDto } from "@/features/sales/dto/order.dto";

export async function getDashboardOrders(
  storeIds: string[],
  fromDate: string,
  toDate: string,
  accessToken: string,
): Promise<OrderResponseDto[]> {
  const responses = await Promise.all(
    [...new Set(storeIds)].map((storeId) =>
      axiosAuth.get<OrderResponseDto[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${storeId}`,
        {
          params: { fromDate, toDate },
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      ),
    ),
  );
  return responses.flatMap((response) => response.data);
}

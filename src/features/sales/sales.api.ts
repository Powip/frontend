// import { GATEWAY } from "@/lib/gateway";
import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import type { OrderResponseDto } from "./dto/order.dto";

export async function getSalesByStore(storeId: string): Promise<OrderResponseDto[]> {
  const { data } = await axiosAuth.get<OrderResponseDto[]>(
    // `${GATEWAY.ventas}/order-header/store/${storeId}`
    `${API.ventas}/order-header/store/${storeId}`,
  );

  return data;
}

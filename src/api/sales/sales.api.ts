import axiosAuth from "@/lib/axiosAuth";
import { OrderResponseDto } from "./dto/order.dto";
import { GATEWAY } from "@/lib/gateway";

export async function getSalesByStore(
    storeId: string
): Promise<OrderResponseDto[]> {
  const { data } =
    await axiosAuth.get<OrderResponseDto[]>(
      `${GATEWAY.ventas}/order-header/store/${storeId}`
    );

  return data;
};

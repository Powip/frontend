import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { OrderHeader } from "@/interfaces/IOrder";

/** Delegates to the production stock engine; a queued request is not an acknowledgement. */
export async function prepareCommercialOrder(id: string, expectedOrderUpdatedAt: string): Promise<OrderHeader> {
  return (await axiosAuth.post<OrderHeader>(`${GATEWAY.ventas}/order-header/manual/${encodeURIComponent(id)}/commercial-preparation`, {expectedOrderUpdatedAt})).data;
}
